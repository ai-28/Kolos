import { NextResponse } from "next/server";
import { getSheetData, findRowsByProfileId, findRowById, SHEETS, appendToSheet } from "@/app/lib/googleSheets";
import { requireAuth } from "@/app/lib/session";
import { normalizeRole } from "@/app/lib/roleUtils";
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

export async function POST(request) {
    try {
        // Require authentication
        const session = await requireAuth();
        const userRole = session.role || '';
        const sessionClientId = session.clientId;

        // Check if user is admin
        const normalizedRole = normalizeRole(userRole);
        const isAdmin = normalizedRole === 'Admin';

        const { profile_id, updated_content } = await request.json();

        if (!profile_id) {
            return NextResponse.json(
                { error: "profile_id is required" },
                { status: 400 }
            );
        }

        // Users can only update their own signals, unless they're an admin
        if (!isAdmin && profile_id !== sessionClientId) {
            return NextResponse.json(
                { error: "Forbidden: You can only update your own signals" },
                { status: 403 }
            );
        }

        if (!updated_content || !updated_content.trim()) {
            return NextResponse.json(
                { error: "updated_content is required" },
                { status: 400 }
            );
        }

        const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
        if (!SPREADSHEET_ID) {
            throw new Error("GOOGLE_SHEET_ID environment variable is not set");
        }

        const sheets = getSheetsClient();

        // Step 1: Get existing client profile
        const profile = await findRowById(SHEETS.PROFILES, profile_id);

        if (!profile) {
            return NextResponse.json(
                { error: "Client profile not found" },
                { status: 404 }
            );
        }

        // Step 2: Update client profile with updated_content field
        const profiles = await getSheetData(SHEETS.PROFILES);
        const clientIndex = profiles.findIndex(
            (p) => {
                const clientId = p.id || p.ID || p["id"] || p["ID"];
                return clientId && String(clientId).trim() === String(profile_id).trim();
            }
        );

        // Get headers to find updated_content column
        const headersResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.PROFILES}!1:1`,
        });
        const headers = headersResponse.data.values?.[0] || [];

        // Check if updated_content column exists, if not we'll append it
        let updatedContentColumnIndex = headers.findIndex(
            h => h && h.toLowerCase() === 'updated_content'
        );

        if (updatedContentColumnIndex === -1) {
            // Column doesn't exist, add it
            updatedContentColumnIndex = headers.length;
            const columnLetter = getColumnLetter(updatedContentColumnIndex);

            // Add header
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.PROFILES}!${columnLetter}1`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [['updated_content']],
                },
            });
        }

        // Update the updated_content field
        const rowNumber = clientIndex + 2;
        const columnLetter = getColumnLetter(updatedContentColumnIndex);
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.PROFILES}!${columnLetter}${rowNumber}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[updated_content.trim()]],
            },
        });

        console.log(`✅ Updated client profile with updated_content for profile_id: ${profile_id}`);

        // Step 3: Delete existing signals for this profile_id
        const existingSignals = await findRowsByProfileId(SHEETS.SIGNALS, profile_id);

        if (existingSignals.length > 0) {
            // Get all signals to find row numbers
            const allSignals = await getSheetData(SHEETS.SIGNALS);

            // Find row indices for signals matching this profile_id
            const signalIndices = [];
            for (let i = 0; i < allSignals.length; i++) {
                const signal = allSignals[i];
                const signalProfileId = signal.profile_id || signal["profile_id"] || signal["Profile ID"];
                if (signalProfileId && String(signalProfileId).trim() === String(profile_id).trim()) {
                    signalIndices.push(i);
                }
            }

            // Delete rows in reverse order to maintain correct indices
            if (signalIndices.length > 0) {
                const sheetId = await getSheetId(SPREADSHEET_ID, SHEETS.SIGNALS, sheets);

                // Sort indices in descending order for deletion
                signalIndices.sort((a, b) => b - a);

                const deleteRequests = signalIndices.map(index => ({
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: index + 1, // +1 because row 0 is header
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

                console.log(`✅ Deleted ${signalIndices.length} existing signals for profile_id: ${profile_id}`);
            }
        }

        // Step 4: Prepare profile data with updated_content for LLM
        const profileForLLM = {
            ...profile,
            updated_content: updated_content.trim(),
        };

        // Ensure profile is always defined and safe
        const safeProfile = profileForLLM || {};

        // Step 5: Use GPT-5.2 compatible prompt structure
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
      "date": "February 21 - 23, 2025\nFebruary 27 - March 5, 2025"
    }
  ],
  "upcoming_industry_events": [
    {
      "event_name": "Ken Hersh Private Equity & Sports",
      "industry": "💼 Finance & Private Equity",
      "location": "Virtual",
      "event_date": "March 8, 2025 (11 AM ET)"
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

        // Step 6: Call OpenAI with the same structure as recommendations API
        let parsedData;
        // Store profileForLLM in outer scope for error logging
        const profileForLLMForError = profileForLLM;
        try {
            const completion = await openaiClient.responses.create({
                model: "gpt-5.1",  // Try gpt-5.1 first, fallback to "gpt-4o" if unavailable
                input: prompt,
                tools: [
                    { type: "web_search" }
                ],
                temperature: 0.3
            });

            // Parse the JSON response
            const responseContent = completion.output_text;

            console.log(`📝 Model used: gpt-5.2`);
            console.log(`📝 Response type: ${typeof responseContent}`);
            console.log(`📝 Response length: ${responseContent?.length || 0} characters`);
            console.log(`📝 Response preview (first 500 chars): ${responseContent?.substring(0, 500) || 'No content'}`);

            if (typeof responseContent === 'object') {
                parsedData = responseContent;
            } else {
                let jsonString = responseContent.trim();

                // Remove markdown code blocks if present (gpt-5.2 might add them)
                if (jsonString.startsWith('```json')) {
                    jsonString = jsonString.replace(/^```json\s*/i, '').replace(/\s*```\s*$/i, '');
                } else if (jsonString.startsWith('```')) {
                    jsonString = jsonString.replace(/^```\s*/i, '').replace(/\s*```\s*$/i, '');
                }

                // Extract JSON object (find first { and last })
                const firstBrace = jsonString.indexOf('{');
                const lastBrace = jsonString.lastIndexOf('}');

                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    jsonString = jsonString.substring(firstBrace, lastBrace + 1);
                }

                jsonString = jsonString.trim();

                // Log before parsing for debugging
                console.log(`📝 Extracted JSON length: ${jsonString.length}`);
                console.log(`📝 JSON starts with: ${jsonString.substring(0, 50)}`);
                console.log(`📝 JSON ends with: ${jsonString.substring(Math.max(0, jsonString.length - 50))}`);

                parsedData = JSON.parse(jsonString);

                // Log parsed structure
                console.log(`📝 Parsed data keys: ${Object.keys(parsedData || {}).join(', ')}`);
                console.log(`📝 Signals count: ${parsedData.signals?.length || 0}`);
            }

            // Validate that we got signals
            if (!parsedData.signals || !Array.isArray(parsedData.signals) || parsedData.signals.length === 0) {
                console.error("⚠️ OpenAI returned no signals or empty signals array");
                console.error("Response content preview:", responseContent?.substring(0, 1000));
                console.error("Full parsed data:", JSON.stringify(parsedData, null, 2).substring(0, 1000));
                console.error("Profile data that was sent:", JSON.stringify(profileForLLM, null, 2).substring(0, 500));

                const errorMsg = `OpenAI returned no signals. Response preview: ${responseContent?.substring(0, 200) || 'No response content'}. ` +
                    `This may be due to insufficient profile data or OpenAI API limitations.`;

                throw new Error(errorMsg);
            }

            console.log(`✅ OpenAI generated ${parsedData.signals.length} signals`);

        } catch (apiError) {
            console.error("❌ Error calling OpenAI API:", apiError);
            console.error("Error details:", {
                message: apiError.message,
                name: apiError.name,
                code: apiError.code,
                status: apiError.status,
                statusText: apiError.statusText,
                response: apiError.response?.data,
                stack: apiError.stack?.substring(0, 1000)
            });

            // Extract more detailed error information
            let errorDetails = apiError.message || "OpenAI API call failed";
            let errorCode = "UNKNOWN";

            // If it's an OpenAI API error, get more details
            if (apiError.response?.data) {
                const openaiError = apiError.response.data;
                errorDetails = openaiError.error?.message || errorDetails;
                // Prioritize OpenAI error code over HTTP status code
                errorCode = openaiError.error?.code || openaiError.error?.type || apiError.status || apiError.code || "UNKNOWN";
                console.error("OpenAI API error response:", JSON.stringify(openaiError, null, 2));
            } else {
                // Fallback to status code or error code if no response data
                errorCode = apiError.status || apiError.code || "UNKNOWN";
            }

            // Also check error message for quota/billing keywords if code extraction failed
            if (errorCode === "UNKNOWN" || errorCode === 429) {
                const errorMsgLower = errorDetails.toLowerCase();
                if (errorMsgLower.includes("quota") || errorMsgLower.includes("billing")) {
                    errorCode = "insufficient_quota";
                } else if (errorMsgLower.includes("rate limit")) {
                    errorCode = "rate_limit_exceeded";
                }
            }

            // Log profile data for debugging
            console.error("Profile data that caused the error:", JSON.stringify(profileForLLMForError, null, 2).substring(0, 1000));

            // Return error response with detailed information
            const getSuggestion = (code, details = "") => {
                const codeStr = String(code).toLowerCase();
                const detailsLower = String(details).toLowerCase();

                // Check both code and details for quota/billing
                if (code === "insufficient_quota" || codeStr.includes("quota") || codeStr.includes("billing") ||
                    detailsLower.includes("quota") || detailsLower.includes("billing") || detailsLower.includes("exceeded your current quota")) {
                    return "OpenAI API quota exceeded. Please check your OpenAI account billing and upgrade your plan at https://platform.openai.com/account/billing";
                }

                // Check for rate limit (but not quota)
                if (code === "rate_limit_exceeded" || (code === 429 && !detailsLower.includes("quota")) || codeStr.includes("rate_limit")) {
                    return "OpenAI API rate limit exceeded. Please try again in a few minutes.";
                }

                if (code === "model_not_found" || code === 404 || codeStr.includes("404")) {
                    return "The model 'gpt-5.1' may not be available. Try using 'gpt-4o' instead.";
                }

                if (code === "invalid_api_key" || code === 401 || codeStr.includes("401")) {
                    return "Please check your OPENAI_API_KEY environment variable.";
                }

                return "Please check the server logs for more details. The error may be due to insufficient profile data, API issues, or model unavailability.";
            };

            return NextResponse.json(
                {
                    error: "Failed to generate signals",
                    details: errorDetails,
                    error_code: String(errorCode),
                    error_type: apiError.name || "APIError",
                    profile_id: profile_id,
                    suggestion: getSuggestion(errorCode, errorDetails),
                },
                { status: 500 }
            );
        }

        // Step 7: Save new signals to Signals table IMMEDIATELY (no Apollo delay)
        if (parsedData.signals && Array.isArray(parsedData.signals) && parsedData.signals.length > 0) {
            let signalsSaved = 0;

            // Save all signals immediately without Apollo enrichment
            for (const signal of parsedData.signals) {
                // Prefix date with apostrophe to force Google Sheets to store as text (prevents serial number conversion)
                const dateValue = signal.date ? `'${signal.date}` : '';
                const signalRow = [
                    profile_id,
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
                    await appendToSheet(SHEETS.SIGNALS, signalRow);
                    signalsSaved++;
                } catch (error) {
                    console.error('❌ Error saving signal to Google Sheets:', error);
                    console.error('Signal data that failed to save:', signalRow);
                }
            }

            if (signalsSaved === 0) {
                console.error("⚠️ No signals were saved! Check Google Sheets connection.");
                return NextResponse.json(
                    {
                        error: "No signals were saved",
                        details: "Failed to save signals to Google Sheets. Please check the logs.",
                    },
                    { status: 500 }
                );
            }

            console.log(`✅ ${signalsSaved} new signals saved to Google Sheets`);
        }

        // Step 9: Update profile with new travel plans and events (if needed)
        // Convert travel plans and events arrays to JSON strings for storage
        const opmTravelPlansJson = parsedData.opm_travel_plans && Array.isArray(parsedData.opm_travel_plans)
            ? JSON.stringify(parsedData.opm_travel_plans)
            : '';
        const upcomingEventsJson = parsedData.upcoming_industry_events && Array.isArray(parsedData.upcoming_industry_events)
            ? JSON.stringify(parsedData.upcoming_industry_events)
            : '';

        // Update opm_travel_plans and upcoming_industry_events columns if they exist
        const opmColumnIndex = headers.findIndex(h => h && (h.toLowerCase() === 'opm_travel_plans' || h.toLowerCase() === 'opm travel plans'));
        const eventsColumnIndex = headers.findIndex(h => h && (h.toLowerCase() === 'upcoming_industry_events' || h.toLowerCase() === 'upcoming industry events'));

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

        // Get updated signals count
        const newSignals = await findRowsByProfileId(SHEETS.SIGNALS, profile_id);

        return NextResponse.json({
            success: true,
            message: "Signals updated successfully",
            signals_count: newSignals.length,
            profile_id: profile_id,
        });

    } catch (error) {
        console.error("❌ Error updating signals:", error);
        console.error("Full error details:", {
            message: error.message,
            name: error.name,
            stack: error.stack?.substring(0, 1000),
            cause: error.cause,
        });

        return NextResponse.json(
            {
                error: "Failed to update signals",
                details: error.message || "An unexpected error occurred",
                error_type: error.name || "Error",
                suggestion: "Please check the server logs for more details. Common issues: missing profile data, OpenAI API errors, Google Sheets connection issues, or model unavailability.",
            },
            { status: 500 }
        );
    }
}


