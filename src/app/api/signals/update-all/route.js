import { NextResponse } from "next/server";
import { getSheetData, SHEETS } from "@/app/lib/googleSheets";
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { join } from 'path';
import OpenAI from "openai";

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function getSheetsClient() {
    let credentials;
    if (process.env.GOOGLE_CREDENTIALS) {
        credentials = typeof process.env.GOOGLE_CREDENTIALS === 'string'
            ? JSON.parse(process.env.GOOGLE_CREDENTIALS)
            : process.env.GOOGLE_CREDENTIALS;
    } else {
        const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || 'kolos-project-40696a085f6e.json';
        const fullPath = credentialsPath.startsWith('/') || credentialsPath.startsWith('C:') || credentialsPath.startsWith('E:')
            ? credentialsPath
            : join(process.cwd(), credentialsPath.replace(/^\.\//, ''));
        const credentialsFile = readFileSync(fullPath, 'utf8');
        credentials = JSON.parse(credentialsFile);
    }

    const auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return google.sheets({ version: 'v4', auth });
}

// Helper to get sheet ID
async function getSheetId(spreadsheetId, sheetName, sheets) {
    const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: spreadsheetId,
    });
    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
    return sheet ? sheet.properties.sheetId : null;
}

// Helper to convert column index to letter
const getColumnLetter = (index) => {
    let result = '';
    while (index >= 0) {
        result = String.fromCharCode(65 + (index % 26)) + result;
        index = Math.floor(index / 26) - 1;
    }
    return result;
};

/**
 * Cron job endpoint to update signals for all clients
 * Protected by CRON_SECRET environment variable
 * 
 * Usage: POST /api/signals/update-all
 * Headers: Authorization: Bearer YOUR_CRON_SECRET
 * Body (optional): { "profile_ids": ["id1", "id2"], "skip_profile_ids": ["id3"] }
 */
// GET handler for testing/status
export async function GET() {
    return NextResponse.json({
        message: "Signal Update API Endpoint",
        method: "Use POST method to trigger signal updates",
        authentication: "Requires Authorization: Bearer CRON_SECRET header",
        usage: "POST /api/signals/update-all",
        body: {
            profile_ids: "optional - comma-separated profile IDs to update",
            skip_profile_ids: "optional - comma-separated profile IDs to skip"
        }
    }, { status: 200 });
}

export async function POST(request) {
    const startTime = Date.now();
    console.log(`🕐 Starting bulk signal update at ${new Date().toISOString()}`);

    try {
        // Verify cron secret from Authorization header
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret) {
            console.error('❌ CRON_SECRET environment variable not set');
            return NextResponse.json(
                { error: "Server configuration error: CRON_SECRET not set" },
                { status: 500 }
            );
        }

        // Check authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: "Unauthorized: Missing or invalid Authorization header" },
                { status: 401 }
            );
        }

        const providedSecret = authHeader.substring(7); // Remove 'Bearer ' prefix
        if (providedSecret !== cronSecret) {
            return NextResponse.json(
                { error: "Unauthorized: Invalid secret" },
                { status: 401 }
            );
        }

        // Parse optional request body
        let targetProfileIds = null;
        let skipProfileIds = [];
        try {
            const body = await request.json();
            targetProfileIds = body.profile_ids || null;
            skipProfileIds = body.skip_profile_ids || [];
        } catch (e) {
            // No body or invalid JSON - that's fine, we'll process all profiles
        }

        const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
        if (!SPREADSHEET_ID) {
            throw new Error("GOOGLE_SHEET_ID environment variable is not set");
        }

        const sheets = getSheetsClient();

        // Get all client profiles
        console.log('📊 Fetching all client profiles...');
        const profiles = await getSheetData(SHEETS.PROFILES);

        if (!profiles || profiles.length === 0) {
            return NextResponse.json({
                success: true,
                message: "No profiles found to update",
                profiles_processed: 0,
                profiles_succeeded: 0,
                profiles_failed: 0,
                duration_seconds: (Date.now() - startTime) / 1000,
            });
        }

        // Filter profiles based on target/skip lists
        let profilesToProcess = profiles.filter(p => {
            const profileId = p.id || p.ID || p["id"] || p["ID"];
            if (!profileId) return false;

            // If target list is provided, only process those
            if (targetProfileIds && !targetProfileIds.includes(String(profileId).trim())) {
                return false;
            }

            // Skip profiles in skip list
            if (skipProfileIds.includes(String(profileId).trim())) {
                return false;
            }

            return true;
        });

        console.log(`📋 Found ${profiles.length} total profiles, will process ${profilesToProcess.length} profiles in background`);

        // Return immediately - processing will happen in background
        const response = NextResponse.json({
            success: true,
            message: `Signal update started. Processing ${profilesToProcess.length} profiles in background.`,
            status: "processing",
            profiles_total: profilesToProcess.length,
            note: "Processing started. Check server logs for progress. All profiles will be processed automatically."
        }, { status: 202 }); // 202 Accepted - processing started

        // Process all profiles in background (don't await - fire and forget)
        processAllProfilesInBackground(
            profilesToProcess,
            sheets,
            SPREADSHEET_ID
        ).catch(error => {
            console.error("❌ Background processing error:", error);
            console.error("Error stack:", error.stack);
        });

        return response;

    } catch (error) {
        console.error("❌ Error in bulk signal update:", error);
        const duration = (Date.now() - startTime) / 1000;

        return NextResponse.json(
            {
                error: "Failed to update signals in bulk",
                details: error.message || "An unexpected error occurred",
                duration_seconds: duration
            },
            { status: 500 }
        );
    }
}

/**
 * Process all profiles in background (non-blocking)
 */
async function processAllProfilesInBackground(profilesToProcess, sheets, SPREADSHEET_ID) {
    const startTime = Date.now();
    const results = {
        total: profilesToProcess.length,
        succeeded: 0,
        failed: 0,
        errors: [],
        profile_results: []
    };

    console.log(`\n🔄 Starting background processing of ${profilesToProcess.length} profiles...`);

    // Process each profile
    for (let i = 0; i < profilesToProcess.length; i++) {
        const profile = profilesToProcess[i];
        const profileId = profile.id || profile.ID || profile["id"] || profile["ID"];

        console.log(`\n📝 [${i + 1}/${profilesToProcess.length}] Processing profile: ${profileId} (${profile.name || 'Unknown'})`);

        try {
            // Get updated_content if it exists
            const updatedContent = profile.updated_content || profile["updated_content"] || '';

            // Call the signal generation logic
            const signalsGenerated = await updateSignalsForProfile(
                profileId,
                profile,
                updatedContent,
                sheets,
                SPREADSHEET_ID
            );

            results.succeeded++;
            results.profile_results.push({
                profile_id: profileId,
                name: profile.name || 'Unknown',
                status: 'success',
                signals_generated: signalsGenerated
            });

            console.log(`✅ [${i + 1}/${profilesToProcess.length}] Successfully updated ${signalsGenerated} signals for profile ${profileId}`);

        } catch (error) {
            results.failed++;
            const errorMessage = error.message || 'Unknown error';
            results.errors.push({
                profile_id: profileId,
                name: profile.name || 'Unknown',
                error: errorMessage
            });
            results.profile_results.push({
                profile_id: profileId,
                name: profile.name || 'Unknown',
                status: 'failed',
                error: errorMessage
            });

            console.error(`❌ [${i + 1}/${profilesToProcess.length}] Failed to update signals for profile ${profileId}:`, errorMessage);
        }

        // Add a small delay between profiles to avoid rate limits
        if (i < profilesToProcess.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        }
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`\n✅ Background processing completed in ${duration.toFixed(2)} seconds`);
    console.log(`📊 Final Results: ${results.succeeded} succeeded, ${results.failed} failed out of ${results.total} total profiles`);

    // Log summary
    if (results.errors.length > 0) {
        console.log(`\n⚠️  Errors encountered:`);
        results.errors.forEach(err => {
            console.log(`   - ${err.name || err.profile_id}: ${err.error}`);
        });
    }

    return results;
}

/**
 * Update signals for a single profile (extracted from the main update route)
 */
async function updateSignalsForProfile(profileId, profile, updatedContent, sheets, SPREADSHEET_ID) {
    // Step 1: Delete existing signals for this profile
    const allSignals = await getSheetData(SHEETS.SIGNALS);
    const signalIndices = [];

    for (let i = 0; i < allSignals.length; i++) {
        const signal = allSignals[i];
        const signalProfileId = signal.profile_id || signal["profile_id"] || signal["Profile ID"];
        if (signalProfileId && String(signalProfileId).trim() === String(profileId).trim()) {
            signalIndices.push(i);
        }
    }

    // Delete existing signals if any
    if (signalIndices.length > 0) {
        const sheetId = await getSheetId(SPREADSHEET_ID, SHEETS.SIGNALS, sheets);
        signalIndices.sort((a, b) => b - a);

        const deleteRequests = signalIndices.map(index => ({
            deleteDimension: {
                range: {
                    sheetId: sheetId,
                    dimension: 'ROWS',
                    startIndex: index + 1,
                    endIndex: index + 2,
                },
            },
        }));

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: deleteRequests,
            },
        });

        console.log(`  🗑️  Deleted ${signalIndices.length} existing signals`);
    }

    // Step 2: Prepare profile data for LLM
    const profileForLLM = {
        ...profile,
        updated_content: updatedContent.trim(),
    };

    // Step 3: Generate signals using OpenAI (same prompt as the main route)
    const prompt = `
PRECONDITIONS:
- Client profile is provided below (guaranteed to exist)
- Web search tool is available for use
- Updated content is provided for context
- You must return valid JSON regardless of data availability

CRITICAL OUTPUT REQUIREMENT: 
Return ONLY valid JSON. Start with {, end with }. No markdown, no code blocks, no explanations.
- If you cannot find all items, return as many verified items as possible (minimum 0)
- Return empty arrays if zero items can be verified
- NEVER return error messages or apologies
- JSON must be parseable without preprocessing

ROLE: Kolos Signals engine for B2B clients.

GOAL: Find specific events that can become pipeline for this client, not generic news.

OUTPUT TARGETS (flexible based on availability):
- Up to 8 high-value signals (aim for 8, but return as many as you can verify, minimum 0)
- Up to 3 OPM Travel Plans (aim for 3, but return as many as you can create, minimum 0)
- Up to 3 Upcoming Industry Events (aim for 3, but return as many as you can verify, minimum 0)

Each signal includes: date, headline_source, url, signal_type, scores_R_O_A, overall, next_step, estimated_target_value_USD

------------------------------------------------
STEP 1 - BUILD CLIENT PROFILE
------------------------------------------------
These following variables are in the profile object.
- name
- email
- role
- company
- industries
The top one to three industries or themes the user is currently focused on.
- project_size
The approximate total size or value of the user's main project or deal (e.g., 50–150 million).
- raise_amount
The amount of capital the user aims to raise for their project in the next 6–12 months (range in millions).
- check_size
The typical investment amount the user commits per deal (e.g., 5–15 million).
- active_raise_amount
Details of any active fundraising the user is doing now, including amount and timeline.
- goals
The user's top one or two business goals for the next 12 months.
- regions
The regions or locations the user focuses on for deals (e.g., US, Europe, MENA, specific cities).
- partner_types
The types of partners the user wants to meet through Kolos (e.g., co-GPs, LPs, operators, clients, suppliers).
- constraints_notes
Any restrictions or requirements to consider when matching partners (e.g., minimum LP ticket size, preferred structure, risk preferences).
- active_deal
A brief description (1–2 sentences) of any active deal where an intro this month would help.
- travel_cities
Cities the user expects to visit in the next 6–12 months for business, for event or in-person intro planning.
- strategy_focus
The investment strategy focus of the user (e.g., VC, growth, buyout, credit).
- business_stage
The current business stage of the user's company or target companies (e.g., idea, early revenue, growth, scaling).
- revenue_range
The current annual revenue range of the user's business or target businesses.
- facilitator_clients
The primary types of clients the user serves or works with (e.g., CEOs, family offices, funds, corporates).
- deal_type
The types of deals the user supports or focuses on (e.g., M&A, capital raise, buy side, sell side, equity, debt).
- deal_size
The typical deal size range the user works with or targets.
- ideal_ceo_profile
The characteristics of the ideal CEO or business owner match for the user (size, situation, industry, etc.).
- ideal_intro
The single most valuable introduction the user needs right now.
- updated_content
ADDITIONAL CONTEXT: This field contains updated information, new requirements, or additional context that should be considered when generating signals. Use this information to refine and update the signals accordingly.

And this is the client profile.
${JSON.stringify(profileForLLM, null, 2)}
For the investor or asset manager, strategy_focus, check_size, active_raise_amount are distinctly used than other roles.
For the entrepreneur or founder, business_stage, revenue_range, project_size, raise_amount,active_raise amount are distinctly used than other roles.
For the facilitator, facilitator_clients, deal_type, deal_size, ideal_ceo_profile, ideal_intro are distinctly used than other roles.
${updated_content ? `\nIMPORTANT: The updated_content field contains additional context that should be prioritized when generating signals. Consider this information carefully when searching for and scoring signals.\n` : ''}

---------------------------------
STEP 2 - FIND AND SELECT SIGNALS
---------------------------------

CRITICAL: You MUST use web search to find REAL, VERIFIABLE signals. Do NOT make up or hallucinate any information.

Using the CLIENT_PROFILE${updated_content ? ' and the UPDATED_CONTENT' : ''}:

${updated_content ? `\nIMPORTANT: The updated_content field contains additional context that should be prioritized when generating signals. Consider this information carefully when searching for and scoring signals.\n` : ''}

1) Use web search to find recent news and events that match the client's regions, sectors, and triggers.
   ${updated_content ? `   - Pay special attention to the updated_content field - it may contain new priorities, recent developments, or specific requirements\n` : ''}
   - Search for specific companies, projects, announcements, layoffs, funding rounds, regulatory changes, etc.
   - Search across various domains and sources to find diverse signals (news sites, press releases, official announcements, industry publications, etc.)
   - Only use information from sources you can verify through web search.
   - Every signal MUST have a real, verifiable URL that you found through web search and can access.
   - Perform multiple targeted searches to find diverse, high-quality signals from various sources.
   - Cross-verify critical information (dates, company names, numbers) by checking multiple search results when possible.
   - Prefer reputable sources but include signals from any domain if the information is verifiable and relevant.
   
2) Only keep items that are directly useful to create conversations or deals for this client.  
   - For ${profile.company || 'the client'}: things like mass layoffs, new data center build, grid expansion, utility digitalization, veteran hiring programs, workforce boards initiatives.  
   ${updated_content ? `   - Consider the updated_content when determining relevance\n` : ''}
   
3) Ignore:
   - Macro opinion pieces with no named company or project.
   - Very small local stories with no enterprise angle.
   - Items older than the recency window unless they are still clearly actionable.
   - ANY information you cannot verify through web search
   - Fake link URL or content

4) For each signal you find:
   - Verify the URL is real and accessible through web search - click through or verify the link works
   - Confirm the date is accurate and matches the actual publication date from the source
   - Ensure the headline matches actual news content from the source page
   - Double-check company names, numbers, and facts against search results
   - If information seems questionable, perform additional searches to verify before including it
   - Only include signals where you can confirm the URL, date, and headline are all accurate from your web search

Aim for 8~10 strong actual valid signals that you found through web search.

SCORING (R,O,A - each 1,3,5):
R (Relevance): 5=Direct ICP+region+trigger hit, 3=Related, 1=Background
O (Opportunity): 5=Act within days, 3=Act within weeks, 1=Long-term/stale
A (Actionability): 5=Clear next step, 3=Needs shaping, 1=No obvious action
Format: scores_R_O_A as "R,O,A" string, overall = rounded average

SIGNAL FIELDS:
- date: YYYY-MM-DD format (publication date from source)
- headline_source: One line combining headline + context (Colaberry style)
- url: Real, accessible URL verified through web search (when available)
- signal_type: funding, event, regulation, partner, trend, or opportunity
- scores_R_O_A: "R,O,A" string (e.g., "5,5,4")
- overall: Number 1-5 (rounded average)
- next_step: Concrete action (who, what, timeframe) - avoid "monitor" or "stay in touch"
- estimated_target_value_USD: Currency string (e.g., "$25,000,000") or "N/A"

OPM TRAVEL PLANS:

CRITICAL: All travel plan dates MUST be in the FUTURE and VALID (after run_date).

Generate up to 3 OPM Travel Plans based on client profile. These represent other clients in Kolos network with upcoming travel relevant for networking. Return as many as you can create (minimum 0).

For each travel plan, include:
- customer: 
  - Customer name or initials (e.g., "Vit Goncharuk/AI", "Zoe Zhao/Re", "Hans Hammer")
  - Use realistic names that fit the client's industry and regions
- opm_number:
  - OPM cohort number (e.g., "OPM62", "OPM55", "OPM53")
  - Format: "OPM" followed by 2-digit number (50-99 range)
- travel_plans:
  - Travel route description (e.g., "Washington → Miami", "New York City → Barcelona/YPO Edge", "Germany → New York City")
  - Can include multiple routes per customer (separate with newline character \n)
  - Should align with client's regions, industries, or partner_types when possible
- date:
  - Travel date range (e.g., "February 21 - 23, 2025", "February 18 - 25, 2025")
  - MUST be future dates - all dates must be AFTER the run_date
  - Use dates within the next 6-12 months from run_date
  - Format: "Month DD - DD, YYYY" or "Month DD - Month DD, YYYY" for multi-month spans
  - If multiple date ranges, separate with newline character (\n)
  - Verify dates are valid (e.g., February has 28/29 days, months have correct number of days)
- how_they_can_help:
  - A brief explanation (1-2 sentences) of how this connection can help the client based on their profile, goals, industries, or partner_types
  - Explain the value proposition or potential collaboration opportunity
  - Should be specific to the client's needs and the travel plan's relevance

Focus on travel that could enable:
- In-person networking opportunities
- Regional alignment with client's focus areas
- Industry event attendance
- Strategic partnership meetings

INDUSTRY EVENTS:

CRITICAL: All event dates MUST be in the FUTURE and VALID (after run_date).

Use web search when available to find REAL, VERIFIABLE upcoming industry events. If web search returns limited results, return as many verified events as possible (minimum 0).

Generate up to 3 Upcoming Industry Events matching client's industries, regions, and business goals. Return fewer if you cannot verify 3 real events - do not fabricate.

For each event, include:
- event_name:
  - Full event name from actual event listings found through web search
  - Should be a real, verifiable event that you found through web search
  - Must match the client's industry focus
- industry:
  - Industry category with emoji badge. Use one of:
    - "💼 Finance & Private Equity" (for finance, PE, investment events)
    - "🏗 Real Estate & Infrastructure" (for real estate, construction, infrastructure events)
    - "⚡ Renewable Energy" (for energy, renewables, sustainability events)
    - Or other relevant industry categories based on client profile
- location:
  - Event location (e.g., "Virtual", "Dallas, TX", "Houston, TX", "New York, NY")
  - Use "Virtual" for online events
  - Use city and state format for in-person events
  - Should align with client's regions when possible
  - Must match the actual event location from web search
- event_date:
  - Event date or date range from the actual event listing
  - MUST be future dates - all dates must be AFTER the run_date
  - Include time if available (especially for virtual events)
  - Use dates within the next 6-12 months from run_date
  - Format: "Month DD, YYYY" or "Month DD - DD, YYYY" with optional time (e.g., "March 8, 2025 (11 AM ET)")
  - Verify dates are valid (e.g., February has 28/29 days, months have correct number of days)
  - Only use dates from verified event listings found through web search
- why_it_matters:
  - A brief explanation (1-2 sentences) of why this event matters for the client based on their profile, goals, industries, regions, or business objectives
  - Explain the relevance and potential value (networking, learning, business development opportunities)
  - Should be specific to the client's needs and the event's relevance

Focus on events that:
- Are REAL events found through web search - verify the event exists and has the stated date
- Match the client's primary industries
- Are in regions the client focuses on (or virtual)
- Could provide networking, learning, or business development opportunities
- Are actual industry events (conferences, summits, meetups, webinars) with verifiable information

Return as many verified events as possible (minimum 0). Quality over quantity.

OUTPUT FORMAT:

Return ONLY valid JSON. Start with {, end with }. No markdown, no code blocks, no text before/after.

REQUIREMENTS:
- Valid JSON only (parseable without preprocessing)
- Return as many verified items as possible (arrays can be empty if no items verified)
- All dates must be valid and in correct format
- All strings properly escaped

If no items can be verified, return this structure with empty arrays:
{
  "client_name": "<CLIENT_NAME>",
  "run_date": "<YYYY-MM-DD>",
  "time_window_days": 7,
  "signals": [],
  "opm_travel_plans": [],
  "upcoming_industry_events": []
}

Required structure:

{
  "client_name": "<CLIENT_NAME>",
  "run_date": "<YYYY-MM-DD>",
  "time_window_days": 7,
  "signals": [
    {
      "date": "2025-11-07",
      "headline_source": "Mass layoff wave hits ~1,300 Texans across metros (incl. DFW) - fresh WARN flow for reskilling",
      "url": "https://example.com/article",
      "signal_type": "event",
      "scores_R_O_A": "5,5,4",
      "overall": 5,
      "next_step": "Pull latest TWC WARN list; offer 2–4 week AI/Data reskill cohorts to affected employers + boards; align WIOA funding paths.",
      "estimated_target_value_USD":"$25,000,000"
    }
  ],
  "opm_travel_plans": [
    {
      "customer": "Vit Goncharuk/AI",
      "opm_number": "OPM62",
      "travel_plans": "Washington → Miami\nWashington → Finland",
      "date": "February 21 - 23, 2025\nFebruary 27 - March 5, 2025",
      "how_they_can_help": "This connection can facilitate introductions to AI industry leaders in Miami and European tech hubs, aligning with your focus on AI partnerships and international expansion."
    }
  ],
  "upcoming_industry_events": [
    {
      "event_name": "Ken Hersh Private Equity & Sports",
      "industry": "💼 Finance & Private Equity",
      "location": "Virtual",
      "event_date": "March 8, 2025 (11 AM ET)",
      "why_it_matters": "This event connects private equity professionals and could provide networking opportunities for fundraising or deal sourcing in the sports and finance sectors."
    }
  ]
}

FINAL REQUIREMENTS:
- Return up to 8 signals (overall score > 4) - return as many as verified (minimum 0)
- Return up to 3 OPM Travel Plans - return as many as created (minimum 0)
- Return up to 3 Industry Events - return as many as verified (minimum 0)
- All signal dates: YYYY-MM-DD format matching publication dates
- All numeric values as numbers (not strings)
- scores_R_O_A as string like "5,5,4"
- Prioritize verified signals from web search when available
- Use web search to find real, current information when possible
- If web search unavailable or returns limited results, use verified knowledge but indicate limitations
- Only include signals you can reasonably verify - prefer fewer verified signals over more unverified ones
- CRITICAL: All travel plan and event dates MUST be in the FUTURE (after run_date) and valid
- For Industry Events: Use web search when available to find verified events - return fewer if unable to verify
- For OPM Travel Plans: Create realistic entries aligned with client profile - ensure dates are valid future dates
- Travel plan dates: "Month DD - DD, YYYY" format, valid calendar dates
- Event dates: Include time for virtual events when available
- For travel_plans with multiple routes, separate with newline character (\\n)
- For date fields with multiple dates, separate with newline character (\\n)
- Verify all dates are valid (correct number of days in month, valid month names, etc.)
${updated_content ? `- IMPORTANT: Consider updated_content when generating signals - it contains additional context that should influence signal selection and scoring\n` : ''}

REMEMBER: Your response must be ONLY valid JSON starting with { and ending with }. No other text whatsoever.
`;

    // Call OpenAI
    const completion = await openaiClient.responses.create({
        model: "gpt-5.1",
        input: prompt,
        tools: [
            { type: "web_search" }
        ],
        temperature: 0.3
    });

    const responseContent = completion.output_text;

    // Parse response
    let parsedData;
    if (typeof responseContent === 'object') {
        parsedData = responseContent;
    } else {
        let jsonString = responseContent.trim();

        // Remove markdown code blocks if present
        if (jsonString.startsWith('```json')) {
            jsonString = jsonString.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '');
        } else if (jsonString.startsWith('```')) {
            jsonString = jsonString.replace(/^```\s*/i, '').replace(/\s*```\s*$/i, '');
        }

        // Extract JSON object
        const firstBrace = jsonString.indexOf('{');
        const lastBrace = jsonString.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonString = jsonString.substring(firstBrace, lastBrace + 1);
        }

        parsedData = JSON.parse(jsonString);
    }

    // Validate signals
    if (!parsedData.signals || !Array.isArray(parsedData.signals)) {
        throw new Error('No signals returned from OpenAI');
    }

    // Step 4: Save new signals to Google Sheets
    let signalsSaved = 0;
    for (const signal of parsedData.signals) {
        // Prefix date with apostrophe to force Google Sheets to store as text (prevents serial number conversion)
        const dateValue = signal.date ? `'${signal.date}` : '';
        const signalRow = [
            profileId,
            dateValue,
            signal.headline_source || '',
            signal.url || '',
            signal.signal_type || '',
            signal.scores_R_O_A || '',
            signal.overall || '',
            signal.next_step || '',
            signal.estimated_target_value_USD || '',
            'Draft', // Default status to Draft
        ];

        try {
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.SIGNALS}!A:J`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [signalRow],
                },
            });
            signalsSaved++;
        } catch (error) {
            console.error('  ❌ Error saving signal:', error.message);
        }
    }

    // Step 5: Update profile with travel plans and events if needed
    if (parsedData.opm_travel_plans || parsedData.upcoming_industry_events) {
        const profiles = await getSheetData(SHEETS.PROFILES);
        const clientIndex = profiles.findIndex(p => {
            const pid = p.id || p.ID || p["id"] || p["ID"];
            return pid && String(pid).trim() === String(profileId).trim();
        });

        if (clientIndex !== -1) {
            const headersResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.PROFILES}!1:1`,
            });
            const headers = headersResponse.data.values?.[0] || [];
            const rowNumber = clientIndex + 2;

            const opmTravelPlansJson = parsedData.opm_travel_plans ? JSON.stringify(parsedData.opm_travel_plans) : '';
            const upcomingEventsJson = parsedData.upcoming_industry_events ? JSON.stringify(parsedData.upcoming_industry_events) : '';

            const opmColumnIndex = headers.findIndex(h => h && h.toLowerCase() === 'opm_travel_plans');
            const eventsColumnIndex = headers.findIndex(h => h && h.toLowerCase() === 'upcoming_industry_events');

            const updates = [];
            if (opmColumnIndex !== -1 && opmTravelPlansJson) {
                updates.push({
                    range: `${SHEETS.PROFILES}!${getColumnLetter(opmColumnIndex)}${rowNumber}`,
                    values: [[opmTravelPlansJson]],
                });
            }
            if (eventsColumnIndex !== -1 && upcomingEventsJson) {
                updates.push({
                    range: `${SHEETS.PROFILES}!${getColumnLetter(eventsColumnIndex)}${rowNumber}`,
                    values: [[upcomingEventsJson]],
                });
            }

            if (updates.length > 0) {
                await sheets.spreadsheets.values.batchUpdate({
                    spreadsheetId: SPREADSHEET_ID,
                    resource: {
                        valueInputOption: 'USER_ENTERED',
                        data: updates,
                    },
                });
            }
        }
    }

    return signalsSaved;
}

