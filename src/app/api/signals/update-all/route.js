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

        console.log(`📋 Found ${profiles.length} total profiles, processing ${profilesToProcess.length} profiles`);

        const results = {
            total: profilesToProcess.length,
            succeeded: 0,
            failed: 0,
            errors: [],
            profile_results: []
        };

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
        console.log(`\n✅ Bulk signal update completed in ${duration.toFixed(2)} seconds`);
        console.log(`📊 Results: ${results.succeeded} succeeded, ${results.failed} failed out of ${results.total} total`);

        return NextResponse.json({
            success: true,
            message: `Processed ${results.total} profiles: ${results.succeeded} succeeded, ${results.failed} failed`,
            profiles_total: results.total,
            profiles_succeeded: results.succeeded,
            profiles_failed: results.failed,
            duration_seconds: duration,
            errors: results.errors,
            profile_results: results.profile_results
        });

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
Client Profile Data:
${JSON.stringify(profileForLLM, null, 2)}

${updatedContent ? `\nIMPORTANT: The updated_content field contains additional context that should be prioritized when generating signals.\n` : ''}

---------------------------------
STEP 2 - FIND AND SELECT SIGNALS
---------------------------------

CRITICAL: You MUST use web search to find REAL, VERIFIABLE signals. Do NOT make up or hallucinate any information.

1) Use web search to find recent news and events that match the client's regions, sectors, and triggers.
   ${updatedContent ? `   - Pay special attention to the updated_content field\n` : ''}
   - Search for specific companies, projects, announcements, layoffs, funding rounds, regulatory changes, etc.
   - Only use information from sources you can verify through web search.
   - Every signal MUST have a real, verifiable URL.

2) Only keep items that are directly useful to create conversations or deals for this client.

3) Ignore:
   - Macro opinion pieces with no named company or project.
   - Very small local stories with no enterprise angle.
   - ANY information you cannot verify through web search

Aim for 8~10 strong actual valid signals that you found through web search.

SCORING (R,O,A - each 1,3,5):
R (Relevance): 5=Direct ICP+region+trigger hit, 3=Related, 1=Background
O (Opportunity): 5=Act within days, 3=Act within weeks, 1=Long-term/stale
A (Actionability): 5=Clear next step, 3=Needs shaping, 1=No obvious action
Format: scores_R_O_A as "R,O,A" string, overall = rounded average

SIGNAL FIELDS:
- date: YYYY-MM-DD format (publication date from source)
- headline_source: One line combining headline + context
- url: Real, accessible URL verified through web search
- signal_type: funding, event, regulation, partner, trend, or opportunity
- scores_R_O_A: "R,O,A" string (e.g., "5,5,4")
- overall: Number 1-5 (rounded average)
- next_step: Concrete action (who, what, timeframe)
- estimated_target_value_USD: Currency string (e.g., "$25,000,000") or "N/A"

OUTPUT FORMAT:

Return ONLY valid JSON. Start with {, end with }.

Required structure:

{
  "client_name": "${profile.name || 'Unknown'}",
  "run_date": "${new Date().toISOString().split('T')[0]}",
  "time_window_days": 7,
  "signals": [
    {
      "date": "2025-01-15",
      "headline_source": "Example headline",
      "url": "https://example.com",
      "signal_type": "event",
      "scores_R_O_A": "5,5,4",
      "overall": 5,
      "next_step": "Action step",
      "estimated_target_value_USD": "$25,000,000"
    }
  ],
  "opm_travel_plans": [],
  "upcoming_industry_events": []
}

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
        const signalRow = [
            profileId,
            signal.date || '',
            signal.headline_source || '',
            signal.url || '',
            signal.signal_type || '',
            signal.scores_R_O_A || '',
            signal.overall || '',
            signal.next_step || '',
            signal.estimated_target_value_USD || '',
        ];

        try {
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.SIGNALS}!A:I`,
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

