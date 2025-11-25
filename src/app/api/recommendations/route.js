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
These following questions are used for building profile.
“To start, what is your full name and what do people usually call you?”
“What is your main role today - investor, entrepreneur, asset manager or facilitator?”
“What is the name of your company or main investment vehicle?”
“Which industries or themes are you most focused on right now? You can name up to three.”
“Which regions do you focus on for deals - for example US, Europe, MENA or specific cities?”
“What is your typical check or deal size? Please give a range, like 5 to 15 million.”
“What are your top one or two business goals for the next 12 months?”
“What types of partners are you most interested in meeting through Kolos - for example co GPs, LPs, operators, clients or suppliers?”
“Do you have any active deal or project now where an intro this month would be very helpful? Please describe it in one or two short sentences.”
“Is there anything important about your style or constraints we should respect - for example speed, risk profile, minimum ticket, or topics to avoid?”
“Which cities do you visit most often for business in the next 6 to 12 months?”
“What is the best email and messaging app to reach you for new signals?”

And this is the client profile based on above questions.
${JSON.stringify(profile, null, 2)}
---------------------------------
STEP 2 - FIND AND SELECT SIGNALS
---------------------------------

Using the CLIENT_PROFILE:

1) Search or reason through recent news and events that match the client’s regions, sectors, and triggers.  
2) Only keep items that are directly useful to create conversations or deals for this client.  
   - For Colaberry(client's company name): things like mass layoffs, new data center build, grid expansion, utility digitalization, veteran hiring programs, workforce boards initiatives.  
3) Ignore:
   - Macro opinion pieces with no named company or project.
   - Very small local stories with no enterprise angle.
   - Items older than the recency window unless they are still clearly actionable.

Aim for 10–15 strong items.

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

For each signal create one row with these definitions:

- date:  
  - Event or publication date in client time zone (for Kolos use CT).  

- headline_source:  
  - One line.  
  - Combine short headline + short context phrase.  
  - Example (Colaberry):  
    - "Mass layoff wave hits ~1,300 Texans across metros (incl. DFW) - fresh WARN flow for reskilling"  

- url:  
  - Direct link to the original article or event page.

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
- Return 10-15 signals in the signals array
- All dates must be strings in YYYY-MM-DD format
- All numeric values (time_window_days, overall) must be numbers, not strings
- scores_R_O_A must be a string like "5,5,4"
  
`;

        const completion = await client.chat.completions.create({
            model: "gpt-5.1", // Valid OpenAI model
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7,
            response_format: { type: "json_object" }, // Force JSON output
        });

        const responseContent = completion.choices[0].message.content;

        // Parse the JSON string from OpenAI response
        let parsedData;
        try {
            parsedData = JSON.parse(responseContent);
        } catch (parseError) {
            console.error("Error parsing OpenAI JSON response:", parseError);
            console.error("Raw response:", responseContent);
            return NextResponse.json(
                {
                    error: "Failed to parse AI response as JSON",
                    details: parseError.message,
                },
                { status: 500 }
            );
        }

        // Prepare data with all 13 fields for Airtable webhook
        // Stringify recommendations JSON for Airtable long text field (max 100,000 chars)
        const recommendationsJsonString = JSON.stringify(parsedData, null, 2);

        const airtableData = {
            name: profile.name || null,
            company: profile.company || null,
            email: profile.email || null,
            role: profile.role || null,
            industries: profile.industries || null,
            regions: profile.regions || null,
            check_size: profile.check_size || null,
            goals: profile.goals || null,
            partner_types: profile.partner_types || null,
            active_deal: profile.active_deal || null,
            constraints: profile.constraints || null,
            city: profile.city || null,
            recommendations: recommendationsJsonString, // LLM output as JSON string for Airtable long text field
        };

        // Send to Airtable webhook
        const airtableWebhookUrl = "https://hooks.airtable.com/workflows/v1/genericWebhook/appABufEiJ7K5VzFQ/wfl0ZjgE5vbRt02At/wtrgWLRhLX6Tcl6K1";

        try {
            const webhookResponse = await fetch(airtableWebhookUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(airtableData),
            });

            if (!webhookResponse.ok) {
                console.error("Airtable webhook error:", webhookResponse.status, webhookResponse.statusText);
            } else {
                console.log("✅ Data sent to Airtable webhook successfully");
            }
        } catch (webhookError) {
            console.error("Error sending to Airtable webhook:", webhookError);
            // Don't fail the request if webhook fails, just log it
        }

        // Return the recommendations
        return NextResponse.json({
            status: "success",
            recommendations: parsedData,
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
