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

    const prompt = `
        
CRITICAL OUTPUT REQUIREMENT: You MUST return ONLY valid JSON. No text, no explanations, no markdown. Start with { and end with }. If you cannot complete the task, return valid JSON with empty arrays. NEVER return error messages or "I'm unable" text.

ROLE

You are the Kolos Signals engine for B2B clients.

You take:
- a short client profile
- a time window (usually "next 7 days" or "next 14 days")
- optional priority themes or keywords

You output:
- 8 high value "signals" that look like the Colaberry example
- each signal is a row with fields:
  - date
  - headline_source
  - url
  - signal_type
  - scores_R_O_A
  - overall
  - next_step
- 5 OPM Travel Plans (other clients' travel plans that might be relevant for networking)
- 5 Upcoming Industry Events (industry events that match the client's focus areas)

Your goal is to spot specific events that can become pipeline for this client next week, not generic news.

------------------------------------------------
STEP 1 - BUILD CLIENT PROFILE BY ASKING QUESTIONS
------------------------------------------------
These following variables are in the profile object.
- name
- email
- role
- company
- industries
The top one to three industries or themes the user is currently focused on.
- project_size
The approximate total size or value of the user’s main project or deal (e.g., 50–150 million).
- raise_amount
The amount of capital the user aims to raise for their project in the next 6–12 months (range in millions).
- check_size
The typical investment amount the user commits per deal (e.g., 5–15 million).
- active_raise_amount
Details of any active fundraising the user is doing now, including amount and timeline.
- goals
The user’s top one or two business goals for the next 12 months.
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

And this is the client profile.
${JSON.stringify(profile, null, 2)}
For the investor or asset manager, strategy_focus, check_size, active_raise_amount are distinctly used than other roles.
For the entrepreneur or founder, business_stage, revenue_range, project_size, raise_amount,active_raise amount are distinctly used than other roles.
For the facilitator, facilitator_clients, deal_type, deal_size, ideal_ceo_profile, ideal_intro are distinctly used than other roles.
---------------------------------
STEP 2 - FIND AND SELECT SIGNALS
---------------------------------

CRITICAL: You MUST use web search to find REAL, VERIFIABLE signals. Do NOT make up or hallucinate any information.

Using the CLIENT_PROFILE:

1) Use web search to find recent news and events that match the client's regions, sectors, and triggers.
   - Search for specific companies, projects, announcements, layoffs, funding rounds, regulatory changes, etc.
   - Search across various domains and sources to find diverse signals (news sites, press releases, official announcements, industry publications, etc.)
   - Only use information from sources you can verify through web search.
   - Every signal MUST have a real, verifiable URL that you found through web search and can access.
   - Perform multiple targeted searches to find diverse, high-quality signals from various sources.
   - Cross-verify critical information (dates, company names, numbers) by checking multiple search results when possible.
   - Prefer reputable sources but include signals from any domain if the information is verifiable and relevant.
   
2) Only keep items that are directly useful to create conversations or deals for this client.  
   - For ${profile.company || 'the client'}: things like mass layoffs, new data center build, grid expansion, utility digitalization, veteran hiring programs, workforce boards initiatives.  
   
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

-----------------------------------
STEP 3 - SCORE R, O, A FOR EACH ROW
-----------------------------------

For each selected item, decide:

R - Strategic Relevance (1, 3, 5)  
- 5: Direct hit on ICP + region + trigger. Clear fit with client offers.  
- 3: Related to target sector or region but not perfect fit.  
- 1: Mostly background or far from core focus.

O - Opportunity Window (1, 3, 5)  
- 5: We should act within days (fresh layoffs, new project approval, hot news).  
- 3: Action useful within weeks (early planning, non urgent expansion).  
- 1: Very long term or already “stale”.

A - Actionability (1, 3, 5)  
- 5: Clear next step, obvious contact type, we know what to offer.  
- 3: Some angle exists but needs work to shape the offer.  
- 1: No obvious action from our side.

Then:

- scores_R_O_A = "R,O,A" as a string (for example "5,5,4").  
- overall = rounded average of R, O, A to the nearest integer (1–5).

------------------------------------
STEP 4 - FILL THE ROWS LIKE EXAMPLE
------------------------------------

For each valid signal create one row with these definitions:

- date:  
  - Event or publication date in client time zone (for Kolos use CT).  

- headline_source:  
  - One line.  
  - Combine short headline + short context phrase.  
  - Example (Colaberry):  
    - "Mass layoff wave hits ~1,300 Texans across metros (incl. DFW) - fresh WARN flow for reskilling"  

- url:  
  - Direct link to the original article or event page that you found through web search.
  - It must be a real, accessible URL that you verified through web search.
  - Do NOT make up URLs or use placeholder links.

- signal_type:  
  - Choose one of: funding, event, regulation, partner, trend, opportunity.  
  - Be consistent within one report.

- scores_R_O_A:  
  - String "R,O,A" such as "5,4,5" based on the rules above.

- overall:  
  - Single number 1–5, rounded average of R,O,A.

- next_step:  
  - Very concrete action to take this week or next week.  
  - Include who to approach and what to propose.  
  - Use Colaberry style:  
    - Pull latest TWC WARN list; offer 2–4 week AI/Data reskill cohorts to affected employers + boards; align WIOA funding paths.  
    - Request 20 min intro; propose AI ready workforce pilots for grid build; set quarterly reporting cadence.  

Next_step should always answer:
- who we talk to  
- what we offer  
- how it ties to the news item  
- ideal time frame (this week / this month).

Avoid vague text like "monitor" or "stay in touch".

------------------------------------
STEP 5 - GENERATE OPM TRAVEL PLANS
------------------------------------

CRITICAL: All travel plan dates MUST be in the FUTURE and VALID. Use the current date (run_date) as reference - all dates must be AFTER the run_date.

Generate 5 OPM Travel Plans based on the client profile. These should represent other clients or contacts in the Kolos network who have upcoming travel that might be relevant for networking or in-person introductions.

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

------------------------------------
STEP 6 - GENERATE UPCOMING INDUSTRY EVENTS
------------------------------------

CRITICAL: All event dates MUST be in the FUTURE and VALID. Use the current date (run_date) as reference - all dates must be AFTER the run_date.

Use web search to find REAL, VERIFIABLE upcoming industry events. Search for actual conferences, summits, webinars, and industry gatherings that are scheduled for the future.

Generate 5 Upcoming Industry Events that match the client's industries, regions, and business goals.

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

If you cannot find 5 real, verifiable future events through web search, return fewer events rather than making them up.

-----------------
STEP 7 - OUTPUT
-----------------

CRITICAL: You MUST return ONLY valid JSON. Your entire response must be valid JSON only - no markdown, no code blocks, no explanations, no other text whatsoever. Start with { and end with }.

ABSOLUTELY NO TEXT BEFORE OR AFTER THE JSON. NO APOLOGIES, NO EXPLANATIONS, NO "I'M UNABLE" MESSAGES. ONLY THE JSON OBJECT.

If you cannot complete the task, return a valid JSON object with empty arrays:
{
  "client_name": "<CLIENT_NAME>",
  "run_date": "<YYYY-MM-DD>",
  "time_window_days": 7,
  "signals": [],
  "opm_travel_plans": [],
  "upcoming_industry_events": []
}

DO NOT return any text that is not valid JSON. DO NOT explain why you cannot complete the task. ONLY return the JSON structure above, even if arrays are empty.

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
      "next_step": "Pull latest TWC WARN list; offer 2–4 week AI/Data reskill cohorts to affected employers + boards; align WIOA funding paths."
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

Important:
- Return 8 top high (overall score is more than 4) signals in the signals array
- Return exactly 5 OPM Travel Plans in the opm_travel_plans array
- Return exactly 5 Upcoming Industry Events in the upcoming_industry_events array
- All signal dates must be strings in YYYY-MM-DD format and must match actual publication dates from web search
- All numeric values (time_window_days, overall) must be numbers, not strings
- scores_R_O_A must be a string like "5,5,4"
- Every signal must be valid and verified through web search - NO fake data, NO hallucinated URLs, NO made-up headlines
- Use web search extensively to find real, current information from various domains before including any signal
- Search across diverse sources (news sites, press releases, industry publications, official announcements) but verify all information
- If you cannot verify a URL, date, or headline through web search, DO NOT include that signal
- CRITICAL: All travel plan and event dates MUST be in the FUTURE relative to run_date - verify all dates are valid and after the run_date
- For Industry Events: Use web search to find REAL, VERIFIABLE upcoming events - do NOT make up event names or dates
- For OPM Travel Plans: Create realistic entries that align with the client profile - ensure all dates are valid future dates
- Travel plan dates should be in the format shown in examples (e.g., "February 21 - 23, 2025") and must be valid calendar dates
- Event dates should include time for virtual events when available (e.g., "March 8, 2025 (11 AM ET)") and must be valid calendar dates
- For travel_plans with multiple routes, separate with newline character (\n)
- For date fields with multiple dates, separate with newline character (\n)
- Verify all dates are valid (correct number of days in month, valid month names, etc.)
`;

    // Use Responses API with web search tool
    const completion = await client.responses.create({
      model: "gpt-4o",  // Try gpt-5.1 first, fallback to "gpt-4o" if unavailable
      input: prompt,  // Responses API uses input (string) instead of messages
      tools: [
        { type: "web_search" }
        // { 
        //   type: "web_search",
        //   filters: {
        //     allowed_domains: [
        //       "reuters.com", "bloomberg.com", "techcrunch.com",
        //       "wsj.com", "forbes.com", "crunchbase.com"
        //     ]
        //   }
        // }
      ],
      temperature: 0.3
    });

    // Responses API returns content in output_text field
    const responseContent = completion.output_text;

    // Parse the JSON string from OpenAI response
    let parsedData;
    try {
      // If responseContent is already an object, use it directly
      if (typeof responseContent === 'object') {
        parsedData = responseContent;
      } else {
        let jsonString = responseContent.trim();

        // Remove markdown code blocks if present (even though we asked for pure JSON)
        if (jsonString.startsWith('```json')) {
          jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonString.startsWith('```')) {
          jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        // Try to extract JSON if there's text before/after it
        // Look for the first { and last }
        const firstBrace = jsonString.indexOf('{');
        const lastBrace = jsonString.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonString = jsonString.substring(firstBrace, lastBrace + 1);
        }

        // Remove any leading/trailing non-JSON text
        jsonString = jsonString.trim();

        parsedData = JSON.parse(jsonString);
      }
    } catch (parseError) {
      console.error("Error parsing OpenAI JSON response:", parseError);
      console.error("Raw response content (first 500 chars):", responseContent?.substring(0, 500));

      // Try to provide a more helpful error message
      let errorMessage = parseError.message;
      if (responseContent && typeof responseContent === 'string') {
        if (responseContent.includes("I'm unable") || responseContent.includes("I cannot")) {
          errorMessage = "AI returned an error message instead of JSON. The AI may be unable to complete the request. Please try again or check the client profile data.";
        } else if (!responseContent.includes('{')) {
          errorMessage = "AI response does not contain valid JSON. The response may be empty or in an unexpected format.";
        }
      }

      // As a last resort, try to return empty structure so the API doesn't completely fail
      console.warn("⚠️ Failed to parse JSON, returning empty structure as fallback");
      parsedData = {
        client_name: profile.name || "Unknown",
        run_date: new Date().toISOString().split('T')[0],
        time_window_days: 7,
        signals: [],
        opm_travel_plans: [],
        upcoming_industry_events: []
      };

      // Still log the error for debugging
      console.error("Parse error details:", {
        message: errorMessage,
        preview: responseContent?.substring(0, 200) || "No response content"
      });
    }

    // Import Google Sheets utility
    const { appendToSheet, SHEETS } = await import('@/app/lib/googleSheets');

    // Generate a profile_id (using timestamp for uniqueness)
    const profileId = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 1. Save Profile to Profiles table
    // Convert travel plans and events arrays to JSON strings for storage
    const opmTravelPlansJson = parsedData.opm_travel_plans && Array.isArray(parsedData.opm_travel_plans)
      ? JSON.stringify(parsedData.opm_travel_plans)
      : '';
    const upcomingEventsJson = parsedData.upcoming_industry_events && Array.isArray(parsedData.upcoming_industry_events)
      ? JSON.stringify(parsedData.upcoming_industry_events)
      : '';

    const profileRow = [
      profileId, // id (first column)
      profile.name || '',
      profile.email || '',
      profile.role || '',
      profile.company || '',
      profile.industries || '',
      profile.project_size || '',
      profile.raise_amount || '',
      profile.check_size || '',
      profile.active_raise_amount || '',
      profile.goals || '',
      profile.regions || '',
      profile.partner_types || '',
      profile.constraints_notes || '',
      profile.active_deal || '',
      profile.travel_cities || '',
      profile.strategy_focus || '',
      profile.business_stage || '',
      profile.revenue_range || '',
      profile.facilitator_clients || '',
      profile.deal_type || '',
      profile.deal_size || '',
      profile.ideal_ceo_profile || '',
      profile.ideal_intro || '',
      opmTravelPlansJson, // opm_travel_plans (JSON string)
      upcomingEventsJson, // upcoming_industry_events (JSON string)
    ];

    try {
      await appendToSheet(SHEETS.PROFILES, profileRow);
      console.log('✅ Profile saved to Google Sheets');
    } catch (error) {
      console.error('❌ Error saving profile to Google Sheets:', error);
      console.error('Profile data that failed to save:', profileRow);
      // Continue even if profile save fails, but log the error
    }

    // 2. Save Signals to Signals table
    if (parsedData.signals && Array.isArray(parsedData.signals)) {
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
        ];

        try {
          await appendToSheet(SHEETS.SIGNALS, signalRow);
          signalsSaved++;
        } catch (error) {
          console.error('❌ Error saving signal to Google Sheets:', error);
          console.error('Signal data that failed to save:', signalRow);
        }
      }
      console.log(`✅ ${signalsSaved} signals saved to Google Sheets`);
    }

    // Check if we're using fallback empty data
    const isFallback = parsedData.signals?.length === 0 &&
      parsedData.opm_travel_plans?.length === 0 &&
      parsedData.upcoming_industry_events?.length === 0 &&
      responseContent && typeof responseContent === 'string' &&
      (responseContent.includes("I'm unable") || responseContent.includes("I cannot") || !responseContent.includes('"signals"'));

    // Return the recommendations
    return NextResponse.json({
      status: isFallback ? "partial_success" : "success",
      recommendations: parsedData,
      profile_id: profileId,
      warning: isFallback ? "AI response parsing had issues. Returning empty data structure. Please check the logs for details." : undefined,
    });
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return NextResponse.json(
      {
        error: "Failed to generate recommendations",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
