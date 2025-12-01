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
        
ROLE

You are the Kolos Signals engine for B2B clients.

You take:
- a short client profile
- a time window (usually “next 7 days” or “next 14 days”)
- optional priority themes or keywords

You output:
- 10–15 high value “signals” that look like the Colaberry example
- each signal is a row with fields:
  - date
  - headline_source
  - url
  - category
  - signal_type
  - scores_R_O_A
  - overall
  - next_step

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

And this is the client profile.
${JSON.stringify(profile, null, 2)}
if the role is investor or asset manager, check_size is used, not just raise_amount or project_size.
if the role is entrepreneur or operator or founder or facilitator, project_size and raise_amount is used, not just check_size.
---------------------------------
STEP 2 - FIND AND SELECT SIGNALS
---------------------------------

CRITICAL: You MUST provide REALISTIC and VERIFIABLE signals based on your training data. Do NOT make up or hallucinate any information.

Using the CLIENT_PROFILE:

1) Generate signals based on realistic business scenarios that match the client's regions, sectors, and triggers.
   - Focus on specific companies, projects, announcements, layoffs, funding rounds, regulatory changes, etc. that would realistically exist.
   - Consider diverse sources (news sites, press releases, official announcements, industry publications, etc.)
   - Only create signals that represent realistic, verifiable business opportunities based on patterns you know.
   - Every signal MUST have a realistic URL format that matches the type of source (e.g., reuters.com, bloomberg.com, company websites, etc.)
   - Generate diverse, high-quality signals from various realistic sources.
   - Ensure all information (dates, company names, numbers) is internally consistent and realistic.
   - Prefer reputable source domains but include signals from various realistic domains.
   
2) Only keep items that are directly useful to create conversations or deals for this client.  
   - For ${profile.company || 'the client'}: things like mass layoffs, new data center build, grid expansion, utility digitalization, veteran hiring programs, workforce boards initiatives.  
   
3) Ignore:
   - Macro opinion pieces with no named company or project.
   - Very small local stories with no enterprise angle.
   - Items older than the recency window unless they are still clearly actionable.
   - ANY information that is not realistic or verifiable
   - Fake link URLs or made-up content
   - Information that contradicts known facts

4) For each signal you create:
   - Use realistic URL formats that match the source type (e.g., reuters.com/articles/..., bloomberg.com/news/..., company.com/press/...)
   - Ensure dates are realistic and match the time window (next 7-14 days)
   - Ensure headlines are realistic and match the type of news/event
   - Double-check that company names, numbers, and facts are realistic and internally consistent
   - Only include signals where all information (URL format, date, headline, details) is realistic and could plausibly exist
   - If you're uncertain about any information, DO NOT include that signal

Aim for 8 strong, realistic, and valid signals. If you cannot create 8 realistic signals, return fewer signals rather than making up implausible information.

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
  - Realistic URL format that matches the source type (e.g., reuters.com/articles/..., bloomberg.com/news/..., company.com/press/...)
  - Use proper URL structure for the domain (e.g., reuters.com, bloomberg.com, techcrunch.com, company websites)
  - Do NOT use placeholder URLs like "https://example.com/article" - use realistic URL paths

- category:  
  - Use fixed value <client_slug>_opportunity.  
  - For Colaberry example: colaberry_opportunity.  

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

Avoid vague text like “monitor” or “stay in touch”.

-----------------
STEP 5 - OUTPUT
-----------------

You MUST return a valid JSON object. Your entire response must be valid JSON only, no other text.

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
      "category": "colaberry_opportunity",
      "signal_type": "event",
      "scores_R_O_A": "5,5,4",
      "overall": 5,
      "next_step": "Pull latest TWC WARN list; offer 2–4 week AI/Data reskill cohorts to affected employers + boards; align WIOA funding paths."
    }
  ]
}

Important:
- Return 8 top signals in the signals array (or fewer if you cannot find 8 valid signals through web search)
- All dates must be strings in YYYY-MM-DD format and must match actual publication dates from web search
- All numeric values (time_window_days, overall) must be numbers, not strings
- scores_R_O_A must be a string like "5,5,4"
- Every signal must be realistic and plausible - NO obviously fake data, NO placeholder URLs, NO made-up headlines
- Use realistic information that matches real-world patterns from various domains
- Include signals from diverse realistic sources (news sites, press releases, industry publications, official announcements)
- If you cannot create a realistic, plausible signal with proper URL format, date, and headline, DO NOT include that signal
`;

const completion = await client.chat.completions.create({
  model: "gpt-5.1",  // Using gpt-5.1 which worked for you before
  messages: [{ role: "user", content: prompt }],
  response_format: { type: "json_object" },  // Force JSON output
  temperature: 0.3
});

    // Chat Completions API returns content in choices[0].message.content
    const responseContent = completion.choices[0].message.content;

    // Parse the JSON string from OpenAI response
    let parsedData;
    try {
      // If responseContent is already an object, use it directly
      if (typeof responseContent === 'object') {
        parsedData = responseContent;
      } else {
        parsedData = JSON.parse(responseContent);
      }
    } catch (parseError) {
      console.error("Error parsing OpenAI JSON response:", parseError);
      console.error("Raw response content:", responseContent);
      console.error("Response type:", typeof responseContent);
      return NextResponse.json(
        {
          error: "Failed to parse AI response as JSON",
          details: parseError.message,
        },
        { status: 500 }
      );
    }

    // Import Google Sheets utility
    const { appendToSheet, SHEETS } = await import('@/app/lib/googleSheets');

    // Generate a profile_id (using timestamp for uniqueness)
    const profileId = `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 1. Save Profile to Profiles table
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
          signal.category || '',
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

    // Return the recommendations
    return NextResponse.json({
      status: "success",
      recommendations: parsedData,
      profile_id: profileId,
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
