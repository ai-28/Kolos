import OpenAI from "openai";

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Extract company name, decision maker role, and name from signal data
 * Uses GPT 5.2 with web search to extract structured information from signal
 * Extracts ONLY from signal fields: headline_source, next_step, and source (URL)
 */
async function extractCompanyAndDecisionMaker(signalData) {
    const {
        headline_source,  // Signal headline - most important
        next_step,         // Signal next step - often contains decision maker info
        source,            // Signal source URL - can contain company info
    } = signalData;

    // Combine ONLY signal fields for extraction (these are the source of truth)
    const combinedText = [
        headline_source,  // Signal headline - most important
        next_step,         // Signal next step - often contains decision maker info
        source,            // Signal source URL - can contain company info
    ]
        .filter(Boolean)
        .join(' ');

    if (!combinedText || combinedText.trim().length === 0) {
        return {
            company_name: null,
            decision_makers: [],
        };
    }

    try {
        const prompt = `
CRITICAL OUTPUT REQUIREMENT: 
Return ONLY valid JSON. Start with {, end with }. No markdown, no code blocks, no explanations.
- If you cannot find all items, return as many verified items as possible
- Return null for fields that cannot be found
- JSON must be parseable without preprocessing

TASK: Extract the following information from the signal data below:
1. Company name (the organization or business mentioned in the signal)
2. Decision makers (ALL people who are decision makers, executives, or key contacts mentioned in the signal)
   - Each decision maker should have: name (full name) and role (job title, e.g., CEO, CTO, VP of Sales, Director, etc.)
   - If multiple people are mentioned, extract ALL of them
   - If only one person is mentioned, return an array with one item
   - If no specific person is named but a role is mentioned, use web search to find the person in that role at the company

SIGNAL DATA TO ANALYZE:
${combinedText}

INSTRUCTIONS:
- Use web search to verify company names, find decision maker information, or clarify ambiguous references
- The source URL may contain additional information - use web search to fetch and analyze the page content if needed
- Look for specific company names, executive names, and their titles in the signal headline and next_step text
- The signal headline (headline_source) and next_step fields are the primary sources for finding decision maker information
- If multiple decision makers are mentioned (e.g., "Contact John Smith (CEO) or Jane Doe (CTO)"), extract ALL of them
- If a company is mentioned but no specific person is named, use web search to find the appropriate decision maker(s) (e.g., CEO, CTO, VP) for that company
- Extract the actual company name and all person names with their roles from the signal data - do not make assumptions

Return ONLY valid JSON in this exact format:
{
  "company_name": "Company Name or null",
  "decision_makers": [
    {
      "name": "Full Name",
      "role": "Job Title"
    }
  ]
}

If no decision makers are found, return an empty array: "decision_makers": []
If company name cannot be found, use null: "company_name": null
Return only the JSON object.
`;

        const completion = await openaiClient.responses.create({
            model: "gpt-5.1",  // Use GPT 5.1 (same as signals/update route)
            input: prompt,
            tools: [
                { type: "web_search" }  // Enable web search to verify and find information
            ],
            temperature: 0.3
        });

        const responseText = completion.output_text || '{}';
        let extractedData;

        // Remove markdown code blocks if present
        let jsonString = responseText.trim();
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

        extractedData = JSON.parse(jsonString);

        // Handle both old format (single decision maker) and new format (array)
        const decisionMakers = extractedData.decision_makers || [];

        // If old format exists, convert to new format
        if (extractedData.decision_maker_name && !decisionMakers.length) {
            decisionMakers.push({
                name: extractedData.decision_maker_name,
                role: extractedData.decision_maker_role || null,
            });
        }

        return {
            company_name: extractedData.company_name || null,
            decision_makers: decisionMakers,
        };
    } catch (error) {
        console.error('❌ Error extracting company and decision maker:', error);
        return {
            company_name: null,
            decision_makers: [],
        };
    }
}

/**
 * Enrich a person using Apollo People Match API
 * This endpoint returns email and LinkedIn URL using person_id
 */
async function enrichPersonInApollo(personId, firstName, lastName, organizationName) {
    if (!process.env.APOLLO_API_KEY) {
        throw new Error('APOLLO_API_KEY is not configured');
    }

    if (!personId) {
        return null;
    }

    try {
        // Apollo API: People Match/Enrichment
        // This endpoint returns email and LinkedIn URL
        const enrichResponse = await fetch('https://api.apollo.io/v1/people/match', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'X-Api-Key': process.env.APOLLO_API_KEY,
            },
            body: JSON.stringify({
                person_id: personId,
                first_name: firstName,
                last_name: lastName,
                organization_name: organizationName,
            }),
        });

        if (!enrichResponse.ok) {
            const errorText = await enrichResponse.text();
            console.warn(`⚠️ Apollo enrichment error: ${enrichResponse.status} - ${errorText}`);
            return null;
        }

        const enrichData = await enrichResponse.json();
        const person = enrichData.person || enrichData;

        return {
            email: person.email || null,
            linkedin_url: person.linkedin_url || null,
            phone: person.phone_numbers?.[0]?.raw_number || person.phone_numbers?.[0]?.sanitized_number || null,
        };
    } catch (error) {
        console.warn('⚠️ Error enriching person in Apollo:', error);
        return null;
    }
}

/**
 * Search for a person in Apollo using company name, person name, and role
 * Uses mixed_people/api_search to get person ID, then enriches with people/match to get email and LinkedIn
 * Returns email and LinkedIn URL if found
 */
async function searchPersonInApollo(companyName, personName, personRole) {
    if (!process.env.APOLLO_API_KEY) {
        throw new Error('APOLLO_API_KEY is not configured');
    }

    if (!companyName || !personName) {
        throw new Error('Company name and person name are required for Apollo search');
    }

    try {
        // Step 1: Search for people using mixed_people/api_search to get person ID
        // Apollo API: Mixed People Search
        // Documentation: https://api.apollo.io/api/v1/mixed_people/api_search
        const searchResponse = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'X-Api-Key': process.env.APOLLO_API_KEY,
            },
            body: JSON.stringify({
                q_keywords: personName,
                person_titles: personRole ? [personRole] : [],
                organization_name: companyName,
                page: 1,
                per_page: 1,
            }),
        });

        if (!searchResponse.ok) {
            const errorText = await searchResponse.text();
            throw new Error(`Apollo API error: ${searchResponse.status} - ${errorText}`);
        }

        const searchData = await searchResponse.json();
        const people = searchData.people || [];

        if (people.length === 0) {
            return {
                email: null,
                linkedin_url: null,
                phone: null,
            };
        }

        // Get the first matching person
        const person = people[0];

        // Extract person ID and name parts for enrichment
        const personId = person.id || person.person_id || null;
        const firstName = person.first_name || personName.split(' ')[0] || '';
        const lastName = person.last_name || personName.split(' ').slice(1).join(' ') || '';

        // Step 2: Enrich person using people/match API to get email and LinkedIn
        let email = null;
        let linkedinUrl = null;
        let phone = null;

        if (personId) {
            const enrichedData = await enrichPersonInApollo(personId, firstName, lastName, companyName);
            if (enrichedData) {
                email = enrichedData.email;
                linkedinUrl = enrichedData.linkedin_url;
                phone = enrichedData.phone;
            }
        }

        // Fallback to search result data if enrichment didn't return values
        if (!email) email = person.email || null;
        if (!linkedinUrl) linkedinUrl = person.linkedin_url || null;
        if (!phone) phone = person.phone_numbers?.[0]?.raw_number || person.phone_numbers?.[0]?.sanitized_number || null;

        return {
            email: email,
            linkedin_url: linkedinUrl,
            phone: phone,
        };
    } catch (error) {
        console.error('❌ Error searching Apollo:', error);
        throw error;
    }
}

/**
 * Search for multiple people in Apollo
 * Returns an array of enriched decision makers with their contact information
 */
async function searchMultiplePeopleInApollo(companyName, decisionMakers) {
    if (!decisionMakers || decisionMakers.length === 0) {
        return [];
    }

    const enrichedDecisionMakers = [];

    // Search Apollo for each decision maker
    for (const decisionMaker of decisionMakers) {
        if (!decisionMaker.name) continue;

        try {
            const apolloResult = await searchPersonInApollo(
                companyName,
                decisionMaker.name,
                decisionMaker.role || null
            );

            enrichedDecisionMakers.push({
                name: decisionMaker.name,
                role: decisionMaker.role || null,
                email: apolloResult.email || null,
                linkedin_url: apolloResult.linkedin_url || null,
                phone: apolloResult.phone || null,
            });
        } catch (error) {
            console.error(`❌ Error searching Apollo for ${decisionMaker.name}:`, error);
            // Continue with other decision makers even if one fails
            enrichedDecisionMakers.push({
                name: decisionMaker.name,
                role: decisionMaker.role || null,
                email: null,
                linkedin_url: null,
                phone: null,
                error: error.message,
            });
        }
    }

    return enrichedDecisionMakers;
}

/**
 * Enrich deal with Apollo data
 * Extracts company name, decision maker info from signal, then searches Apollo for email/LinkedIn
 */
export async function enrichDealWithApollo(signalData) {
    const debug = {
        input_data: signalData,
        llm_result: null,
        apollo_result: null,
        final_company_name: null,
        final_decision_maker_name: null,
        final_decision_maker_role: null,
    };

    try {
        // Step 1: Extract company name and decision makers from signal data
        console.log('🔍 Step 1: Extracting company and decision makers info from signal...');
        const extracted = await extractCompanyAndDecisionMaker(signalData);
        debug.llm_result = extracted;

        const companyName = extracted.company_name;
        const decisionMakers = extracted.decision_makers || [];

        debug.final_company_name = companyName;
        debug.final_decision_maker_name = decisionMakers.length > 0 ? decisionMakers[0].name : null;
        debug.final_decision_maker_role = decisionMakers.length > 0 ? decisionMakers[0].role : null;

        // If we don't have company name or any decision makers, we can't search Apollo
        if (!companyName || decisionMakers.length === 0) {
            console.log('⚠️ Missing required data for Apollo search:', {
                companyName: !!companyName,
                decisionMakersCount: decisionMakers.length,
            });
            return {
                ...signalData,
                apollo_enriched: false,
                apollo_error: 'Missing company name or decision makers',
                apollo_debug: debug,
                decision_maker_name: decisionMakers.length > 0 ? decisionMakers[0].name : (signalData.decision_maker_name || ''),
                decision_maker_role: decisionMakers.length > 0 ? decisionMakers[0].role : (signalData.decision_maker_role || ''),
                decision_maker_email: '',
                decision_maker_linkedin_url: signalData.decision_maker_linkedin_url || '',
                decision_maker_phone: '',
                all_decision_makers: JSON.stringify(decisionMakers),
            };
        }

        // Step 2: Search Apollo for all decision makers
        console.log('🔍 Step 2: Searching Apollo for decision makers...', {
            companyName,
            decisionMakersCount: decisionMakers.length,
            decisionMakers: decisionMakers.map(dm => ({ name: dm.name, role: dm.role })),
        });

        const enrichedDecisionMakers = await searchMultiplePeopleInApollo(companyName, decisionMakers);
        debug.apollo_result = enrichedDecisionMakers;

        // Get primary decision maker (first one) for backward compatibility
        const primaryDecisionMaker = enrichedDecisionMakers.length > 0 ? enrichedDecisionMakers[0] : null;

        console.log('✅ Apollo search completed:', {
            totalFound: enrichedDecisionMakers.length,
            withEmail: enrichedDecisionMakers.filter(dm => dm.email).length,
            withLinkedIn: enrichedDecisionMakers.filter(dm => dm.linkedin_url).length,
            primaryFound: !!(primaryDecisionMaker?.email || primaryDecisionMaker?.linkedin_url),
        });

        return {
            ...signalData,
            apollo_enriched: true,
            apollo_error: null,
            apollo_debug: debug,
            // Primary decision maker (for backward compatibility with existing deal structure)
            decision_maker_name: primaryDecisionMaker?.name || '',
            decision_maker_role: primaryDecisionMaker?.role || '',
            decision_maker_email: primaryDecisionMaker?.email || '',
            decision_maker_linkedin_url: primaryDecisionMaker?.linkedin_url || signalData.decision_maker_linkedin_url || '',
            decision_maker_phone: primaryDecisionMaker?.phone || '',
            // All decision makers as JSON string (for storing in spreadsheet)
            all_decision_makers: JSON.stringify(enrichedDecisionMakers),
        };
    } catch (error) {
        console.error('❌ Error in enrichDealWithApollo:', error);
        return {
            ...signalData,
            apollo_enriched: false,
            apollo_error: error.message || 'Unknown error during Apollo enrichment',
            apollo_debug: debug,
            decision_maker_name: signalData.decision_maker_name || '',
            decision_maker_role: signalData.decision_maker_role || '',
            decision_maker_email: '',
            decision_maker_linkedin_url: signalData.decision_maker_linkedin_url || '',
            decision_maker_phone: '',
            all_decision_makers: '[]',
        };
    }
}

