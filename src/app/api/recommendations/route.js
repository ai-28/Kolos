import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req) {
  try {
    const profile = await req.json();

    if (!profile || typeof profile !== "object") {
      return NextResponse.json(
        { error: "Invalid profile data" },
        { status: 400 }
      );
    }

    // Ensure profile is always defined and safe
    const safeProfile = profile || {};

    const prompt = `
PRECONDITIONS:
- Client profile is provided below (guaranteed to exist)
- Web search tool is available for use
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

CLIENT PROFILE (guaranteed to exist):
${JSON.stringify(safeProfile, null, 2)}

Role-specific field usage:
- Investor/Asset Manager: strategy_focus, check_size, active_raise_amount
- Entrepreneur/Founder: business_stage, revenue_range, project_size, raise_amount, active_raise_amount
- Facilitator: facilitator_clients, deal_type, deal_size, ideal_ceo_profile, ideal_intro

SIGNAL GENERATION:

Use web search when available to find REAL, VERIFIABLE signals. If web search is unavailable or returns limited results, use your knowledge base but clearly indicate verification status.

1) Use web search to find recent news and events matching client's regions, sectors, and triggers:
   - Search for companies, projects, announcements, layoffs, funding rounds, regulatory changes
   - Search diverse sources: news sites, press releases, official announcements, industry publications
   - Verify information through web search when possible
   - Every signal should have a verifiable URL when available
   - Cross-verify critical information (dates, company names, numbers) when possible
   - Prefer reputable sources but include any verifiable and relevant information
   
2) Keep items directly useful for creating conversations or deals:
   - For ${safeProfile.company || 'the client'}: mass layoffs, new data center builds, grid expansion, utility digitalization, veteran hiring programs, workforce boards initiatives
   
3) Ignore:
   - Macro opinion pieces with no named company or project
   - Very small local stories with no enterprise angle
   - Items older than recency window unless still actionable
   - Information you cannot verify (when web search is available)

4) For each signal:
   - Verify URL is real and accessible (when web search available)
   - Confirm date matches publication date from source
   - Ensure headline matches actual news content
   - Double-check company names, numbers, and facts
   - Only include signals where you can reasonably verify URL, date, and headline

Target: 8-10 strong verified signals. Return as many as you can verify (minimum 0). Quality over quantity.

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

For each travel plan:
- customer: Name/initials (e.g., "Vit Goncharuk/AI", "Zoe Zhao/Re", "Hans Hammer")
- opm_number: "OPM" + 2-digit number (50-99 range)
- travel_plans: Route(s) separated by \\n if multiple
- date: Future date range(s) after run_date, separated by \\n if multiple
- Format: "Month DD - DD, YYYY" (must be valid calendar dates)
- how_they_can_help: A brief explanation (1-2 sentences) of how this connection can help the client based on their profile, goals, industries, or partner_types. Explain the value proposition or potential collaboration opportunity.

Focus on: In-person networking, regional alignment, industry events, strategic partnerships

INDUSTRY EVENTS:

CRITICAL: All event dates MUST be in the FUTURE and VALID (after run_date).

Use web search when available to find REAL, VERIFIABLE upcoming industry events. If web search returns limited results, return as many verified events as possible (minimum 0).

Generate up to 3 Upcoming Industry Events matching client's industries, regions, and business goals. Return fewer if you cannot verify 3 real events - do not fabricate.

For each event:
- event_name: Full event name from actual event listings (when verified)
- industry: Category with emoji (e.g., "💼 Finance & Private Equity", "🏗 Real Estate & Infrastructure", "⚡ Renewable Energy")
- location: "Virtual" or "City, State"
- event_date: Future date after run_date, include time if virtual
- Format: "Month DD, YYYY" or "Month DD - DD, YYYY" with optional time (e.g., "March 8, 2025 (11 AM ET)")
- why_it_matters: A brief explanation (1-2 sentences) of why this event matters for the client based on their profile, goals, industries, regions, or business objectives. Explain the relevance and potential value.

Focus on: Real verified events, matching primary industries, in client's regions (or virtual), providing networking/learning opportunities

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
      "estimated_target_value_USD": "$25,000,000"
    }
  ],
  "opm_travel_plans": [
    {
      "customer": "Vit Goncharuk/AI",
      "opm_number": "OPM62",
      "travel_plans": "Washington → Miami\\nWashington → Finland",
      "date": "February 21 - 23, 2025\\nFebruary 27 - March 5, 2025",
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

REMEMBER: Your response must be ONLY valid JSON starting with { and ending with }. No other text whatsoever.
`;

    // Use Responses API with web search tool
    const completion = await client.responses.create({
      model: "gpt-5.1",
      input: prompt,
      tools: [
        { type: "web_search" }
      ],
      temperature: 0.3
    });

    // Responses API returns content in output_text field
    const responseContent = completion.output_text;

    console.log(`📝 Response preview (first 500 chars): ${responseContent?.substring(0, 500) || 'No content'}`);

    // Parse the JSON string from OpenAI response
    let parsedData;
    try {
      // If responseContent is already an object, use it directly
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

        parsedData = JSON.parse(jsonString);

      }
    } catch (parseError) {
      console.error("❌ Error parsing JSON response:", parseError);
      return NextResponse.json(
        { error: "Failed to parse OpenAI response", details: parseError.message },
        { status: 500 }
      );
    }

    // Validate response structure
    if (!parsedData || typeof parsedData !== 'object') {
      return NextResponse.json(
        { error: "Invalid response structure from OpenAI" },
        { status: 500 }
      );
    }

    // Ensure arrays exist (can be empty)
    const signals = Array.isArray(parsedData.signals) ? parsedData.signals : [];
    const opmTravelPlans = Array.isArray(parsedData.opm_travel_plans) ? parsedData.opm_travel_plans : [];
    const upcomingIndustryEvents = Array.isArray(parsedData.upcoming_industry_events) ? parsedData.upcoming_industry_events : [];

    console.log(`✅ Parsed ${signals.length} signals, ${opmTravelPlans.length} travel plans, ${upcomingIndustryEvents.length} events`);

    // Save profile and signals to Google Sheets
    const { SHEETS, appendToSheet } = await import("@/app/lib/googleSheets");

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 11); // Ensure 9 characters
    const profileId = `profile_${timestamp}_${randomStr}`;
    console.log(`📝 Generated new profile ID: ${profileId}`);

    const profileFields = [
      'id', 'name', 'email', 'role', 'company', 'industries', 'project_size',
      'raise_amount', 'check_size', 'active_raise_amount', 'goals', 'regions',
      'partner_types', 'constraints_notes', 'active_deal', 'travel_cities',
      'strategy_focus', 'business_stage', 'revenue_range', 'facilitator_clients',
      'deal_type', 'deal_size', 'ideal_ceo_profile', 'ideal_intro',
      'linkedin_url', 'opm_travel_plans', 'upcoming_industry_events'
    ];

    const profileRow = profileFields.map((field, index) => {
      // Special handling for opm_travel_plans and upcoming_industry_events - use LLM result
      if (field === 'opm_travel_plans') {
        return opmTravelPlans.length > 0 ? JSON.stringify(opmTravelPlans) : '';
      }
      if (field === 'upcoming_industry_events') {
        return upcomingIndustryEvents.length > 0 ? JSON.stringify(upcomingIndustryEvents) : '';
      }

      // For all other fields, get from request body (profile object)
      // Try multiple case variations
      const value = profile[field] || profile[field.toLowerCase()] || profile[field.toUpperCase()] ||
        profile[field.charAt(0).toUpperCase() + field.slice(1)] || '';
      return value || '';
    });

    // Set the ID field (first column)
    profileRow[0] = profileId;

    try {
      await appendToSheet(SHEETS.PROFILES, profileRow);
      console.log(`✅ Profile ${profileId} saved to Google Sheets`);
    } catch (error) {
      console.error('❌ Error saving profile to Google Sheets:', error);
    }

    // Create or update user entry for magic link login
    if (profile.email) {
      try {
        const { updateOrCreateUserWithProfileId } = await import("@/app/lib/googleSheets");
        // Get role from profile (try multiple case variations)
        const userRole = profile.role || profile.Role || profile['role'] || '';
        await updateOrCreateUserWithProfileId(profile.email, profileId, userRole);
        console.log(`✅ User entry created/updated for email: ${profile.email}`);
      } catch (error) {
        console.error('❌ Error creating/updating user entry:', error);
        // Don't fail the request if user creation fails
      }
    }

    // Now save signals

    // Save signals
    if (signals.length > 0) {
      let signalsSaved = 0;

      for (const signal of signals) {
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
        ];

        try {
          await appendToSheet(SHEETS.SIGNALS, signalRow);
          signalsSaved++;
        } catch (error) {
          console.error('❌ Error saving signal to Google Sheets:', error);
        }
      }
      console.log(`✅ ${signalsSaved} signals saved to Google Sheets`);
    }

    return NextResponse.json({
      success: true,
      signals: signals,
      opm_travel_plans: opmTravelPlans,
      upcoming_industry_events: upcomingIndustryEvents,
      client_name: parsedData.client_name,
      run_date: parsedData.run_date,
      time_window_days: parsedData.time_window_days,
    });

  } catch (error) {
    console.error("❌ Error in recommendations API:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations", details: error.message },
      { status: 500 }
    );
  }
}
