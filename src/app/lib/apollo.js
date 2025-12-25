import OpenAI from "openai";

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


async function extractCompanyAndDomain(signalData) {
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
            company_domain: null,
        };
    }

    try {
        const prompt = `
CRITICAL OUTPUT REQUIREMENT: 
Return ONLY valid JSON. Start with {, end with }. No markdown, no code blocks, no explanations.
- If you cannot find all items, return as many verified items as possible
- Return null for fields that cannot be found
- JSON must be parseable without preprocessing

TASK: Extract the following information from the signal data below. These 2 fields are CRITICAL for Apollo API search:
1. Company name (organization_name) - The exact, official company/organization name mentioned in the signal
2. Company domain (domain) - Extract the website domain/URL from the signal source URL or company website (e.g., "atkore.com", "microsoft.com")

CRITICAL: Extract company name and domain. We will search Apollo for all CEOs, Presidents, and Chairs of the Board at this company automatically.

SIGNAL DATA TO ANALYZE:
${combinedText}

INSTRUCTIONS FOR EXTRACTION:
- Use web search extensively to verify and find company names and domains
- The source URL may contain additional information - use web search to fetch and analyze the page content if needed
- Look for specific company names in the signal headline and next_step text
- The signal headline (headline_source) and next_step fields are the primary sources for finding company information

FIELD REQUIREMENTS (must match Apollo API format):
1. company_name: 
   - Extract the EXACT, official company name (e.g., "Microsoft Corporation", "Apple Inc.")
   - Keep the full name as mentioned in the signal (including Inc., LLC, Corp if present)
   - Use web search to verify the official company name if ambiguous
   - Return null ONLY if absolutely no company is mentioned

2. company_domain:
   - Extract the website domain from the source URL (e.g., if URL is "https://www.atkore.com/news/article", extract "atkore.com")
   - Remove "www." prefix if present
   - Extract from signal source URL field if available
   - Use web search to find company website if domain not in URL
   - Return null if domain cannot be found
   - Domain is MORE RELIABLE than company name for Apollo search, so prioritize finding it
   - This is the PRIMARY field for Apollo search - try your best to extract it

EXTRACTION PRIORITY:
1. Extract company name from signal headline or source
2. Extract domain from source URL (highest priority - most reliable for Apollo)
3. Use web search to find company website if domain not in URL
4. Use web search to verify company name if ambiguous

Return ONLY valid JSON in this exact format:
{
  "company_name": "Exact Company Name or null",
  "company_domain": "company.com or null"
}

CRITICAL: 
- company_domain is MORE RELIABLE than company_name for Apollo search - prioritize extracting it
- Extract domain from source URL if available (check the "source" field)
- Always extract as many fields as possible - never return all null/empty unless absolutely no information exists
- Use web search to fill in missing information whenever possible
- If you find a company website URL, extract the domain from it
- We will automatically search Apollo for all CEOs, Presidents, and Chairs of the Board at this company

If company name cannot be found, use null: "company_name": null
If domain cannot be found, use null: "company_domain": null
Return only the JSON object.
`;

        const completion = await openaiClient.responses.create({
            model: "gpt-5.2",  // Use GPT 5.1 (same as signals/update route)
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

        return {
            company_name: extractedData.company_name || null,
            company_domain: extractedData.company_domain || null,
        };
    } catch (error) {
        console.error('❌ Error extracting company and domain:', error);
        return {
            company_name: null,
            company_domain: null,
        };
    }
}

/**
 * Normalize company name for Apollo search
 * Removes common suffixes and creates variations
 */
function normalizeCompanyName(companyName) {
    if (!companyName) return [];

    const variations = [companyName.trim()]; // Start with original

    // Remove common suffixes (case-insensitive)
    const suffixes = [
        /\s+Inc\.?$/i,
        /\s+LLC\.?$/i,
        /\s+Corp\.?$/i,
        /\s+Corporation$/i,
        /\s+Ltd\.?$/i,
        /\s+Limited$/i,
        /\s+Co\.?$/i,
        /\s+Company$/i,
        /\s+Group$/i,
        /\s+Holdings$/i,
        /\s+International$/i,
        /\s+Global$/i,
    ];

    let normalized = companyName.trim();

    // Try removing each suffix
    for (const suffix of suffixes) {
        const withoutSuffix = normalized.replace(suffix, '').trim();
        if (withoutSuffix && withoutSuffix !== normalized && withoutSuffix.length > 0) {
            variations.push(withoutSuffix);
        }
    }

    // Remove duplicates and return
    return [...new Set(variations)];
}

/**
 * Search for organization in Apollo to get organization_id or domain
 * Uses Organization Search API: POST /api/v1/mixed_companies/search
 * Priority: Domain search (most reliable) > Normalized name variations > Original name
 */
async function searchOrganizationInApollo(companyName, domain = null) {
    if ((!companyName && !domain) || !process.env.APOLLO_API_KEY) {
        return null;
    }

    // Priority 1: Try domain search first (most reliable)
    if (domain) {
        try {
            console.log(`🔍 Searching organization by domain: ${domain}`);
            const searchBody = {
                page: 1,
                per_page: 1,
                q_organization_domains_list: [domain.toLowerCase()],
            };

            const searchResponse = await fetch('https://api.apollo.io/api/v1/mixed_companies/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'X-Api-Key': process.env.APOLLO_API_KEY,
                },
                body: JSON.stringify(searchBody),
            });

            if (searchResponse.ok) {
                const searchData = await searchResponse.json();
                const organizations = searchData.organizations || [];

                if (organizations.length > 0) {
                    const org = organizations[0];
                    console.log(`✅ Found organization by domain "${domain}": ${org.name}`);
                    return {
                        organization_id: org.id || org.organization_id || null,
                        domain: org.primary_domain || org.domain || domain,
                        name: org.name || companyName,
                    };
                }
            }
            console.log(`⚠️ No organization found by domain: ${domain}`);
        } catch (error) {
            console.warn(`⚠️ Error searching organization by domain:`, error);
        }
    }

    // Priority 2: Try normalized company name variations
    if (companyName) {
        const nameVariations = normalizeCompanyName(companyName);
        console.log(`🔍 Trying ${nameVariations.length} company name variations:`, nameVariations);

        for (const variation of nameVariations) {
            try {
                const searchBody = {
                    page: 1,
                    per_page: 1,
                    q_organization_name: variation,
                };

                const searchResponse = await fetch('https://api.apollo.io/api/v1/mixed_companies/search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache',
                        'X-Api-Key': process.env.APOLLO_API_KEY,
                    },
                    body: JSON.stringify(searchBody),
                });

                if (!searchResponse.ok) {
                    continue; // Try next variation
                }

                const searchData = await searchResponse.json();
                const organizations = searchData.organizations || [];

                if (organizations.length > 0) {
                    const org = organizations[0];
                    console.log(`✅ Found organization with variation "${variation}": ${org.name}`);
                    return {
                        organization_id: org.id || org.organization_id || null,
                        domain: org.primary_domain || org.domain || null,
                        name: org.name || variation,
                    };
                }
            } catch (error) {
                console.warn(`⚠️ Error searching with variation "${variation}":`, error);
                continue; // Try next variation
            }
        }
    }

    console.log(`⚠️ Organization not found: ${companyName || 'N/A'}${domain ? ` (domain: ${domain})` : ''}`);
    return null;
}

/**
 * Enrich a person using Apollo People Match API
 * Uses People Enrichment API: POST /api/v1/people/match
 * API docs: id (not person_id), name (full name), first_name, last_name, organization_name, domain
 */
async function enrichPersonInApollo(personId, firstName, lastName, organizationName) {
    if (!process.env.APOLLO_API_KEY) {
        throw new Error('APOLLO_API_KEY is not configured');
    }

    if (!personId) {
        return null;
    }

    try {
        const enrichBody = {
            id: personId,  // ✅ API expects 'id', not 'person_id'
            reveal_personal_emails: true,  // Required to get personal emails
        };

        // Use 'name' parameter if we have both first and last name (simpler and recommended)
        if (firstName && lastName) {
            enrichBody.name = `${firstName} ${lastName}`;
        } else {
            // Otherwise use separate first_name and last_name
            if (firstName) enrichBody.first_name = firstName;
            if (lastName) enrichBody.last_name = lastName;
        }

        // Include organization_name for better matching
        if (organizationName) {
            enrichBody.organization_name = organizationName;
        }

        const enrichResponse = await fetch('https://api.apollo.io/api/v1/people/match', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'X-Api-Key': process.env.APOLLO_API_KEY,
            },
            body: JSON.stringify(enrichBody),
        });

        if (!enrichResponse.ok) {
            const errorText = await enrichResponse.text();
            console.warn(`⚠️ Apollo enrichment error: ${enrichResponse.status} - ${errorText}`);

            // Log error details for debugging
            try {
                const errorData = JSON.parse(errorText);
                if (errorData.error) {
                    console.warn(`📋 Error: ${errorData.error}`);
                }
            } catch (e) {
                // Error text is not JSON, that's okay
            }

            return null;
        }

        const enrichData = await enrichResponse.json();
        const person = enrichData.person || enrichData;

        // Log what we got back
        if (!person.email && !person.linkedin_url) {
            console.log(`⚠️ Enrichment API returned person but no contact info available`);
        }

        return {
            email: person.email || null,
            linkedin_url: person.linkedin_url || null,
        };
    } catch (error) {
        console.warn('⚠️ Error enriching person in Apollo:', error);
        return null;
    }
}


/**
 * Helper function to perform Apollo API search with given parameters
 */
async function performApolloSearch(searchBody) {
    const searchResponse = await fetch('https://api.apollo.io/api/v1/mixed_people/api_search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'X-Api-Key': process.env.APOLLO_API_KEY,
        },
        body: JSON.stringify(searchBody),
    });

    if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        throw new Error(`Apollo API error: ${searchResponse.status} - ${errorText}`);
    }

    const searchData = await searchResponse.json();
    return searchData.people || [];
}

/**
 * Find all CEOs, Presidents, and Chairs of the Board at a company
 * Uses mixed_people/api_search to find all people with these roles
 * Then enriches all of them to get email and LinkedIn
 */
async function findAllCLevelExecutives(companyName, companyDomain = null) {
    if (!process.env.APOLLO_API_KEY) {
        throw new Error('APOLLO_API_KEY is not configured');
    }

    if (!companyName && !companyDomain) {
        throw new Error('Company name or domain is required');
    }

    try {
        // First, search for organization to get organization_id or domain
        let organizationData = null;
        if (companyName || companyDomain) {
            console.log(`🔍 Searching for organization: ${companyName || 'N/A'}${companyDomain ? ` (domain: ${companyDomain})` : ''}`);
            organizationData = await searchOrganizationInApollo(companyName, companyDomain);
            if (organizationData) {
                console.log(`✅ Found organization: ${organizationData.name} (ID: ${organizationData.organization_id || 'N/A'}, Domain: ${organizationData.domain || 'N/A'})`);
            } else {
                console.log(`⚠️ Organization not found: ${companyName || 'N/A'}`);
                return []; // Can't search without organization
            }
        }

        // Define the roles we're looking for
        const targetRoles = [
            'CEO',
            'Chief Executive Officer',
            'President',
            'chair of board',
            'chairman of board',

        ];

        const allExecutives = [];

        // Search for each role
        for (const role of targetRoles) {
            try {
                console.log(`🔍 Searching for ${role} at ${organizationData.name}...`);

                const searchBody = {
                    page: 1,
                    per_page: 25, // Get up to 25 results per role (in case there are multiple)
                    person_titles: [role],
                };

                // Use organization_ids or q_organization_domains_list
                if (organizationData.organization_id) {
                    searchBody.organization_ids = [organizationData.organization_id];
                } else if (organizationData.domain) {
                    searchBody.q_organization_domains_list = [organizationData.domain];
                } else {
                    console.log(`⚠️ No organization_id or domain available, skipping ${role}`);
                    continue;
                }

                const people = await performApolloSearch(searchBody);
                console.log(`📊 Found ${people.length} ${role}(s) at ${organizationData.name}`);

                // Add all people found for this role (filter out VP/Vice President BEFORE enrichment to save credits)
                for (const person of people) {
                    const personTitle = (person.title || role || '').toLowerCase();

                    // Skip VP/Vice President roles (we only want CEO, President, Chair)
                    // Filter BEFORE enrichment to avoid wasting Apollo credits
                    if (personTitle.includes('vice president') ||
                        personTitle.includes('vp ') ||
                        personTitle.startsWith('vp ') ||
                        personTitle.includes(' vp') ||
                        personTitle.includes('/vp') ||
                        personTitle.match(/\bvp\b/i)) {
                        console.log(`⏭️ Skipping VP (before enrichment): ${person.first_name} ${person.last_name} - ${person.title}`);
                        continue;
                    }

                    // Check if we already have this person (by person_id)
                    const personId = person.id || person.person_id;
                    if (personId && !allExecutives.find(ex => (ex.id || ex.person_id) === personId)) {
                        allExecutives.push({
                            id: personId,
                            person_id: personId,
                            first_name: person.first_name || '',
                            last_name: person.last_name || '',
                            name: `${person.first_name || ''} ${person.last_name || ''}`.trim(),
                            title: person.title || role,
                            organization: person.organization || null,
                        });
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Error searching for ${role}:`, error);
                continue; // Continue with next role
            }
        }

        console.log(`✅ Found ${allExecutives.length} total executives (CEO/President/Chair)`);

        // Now enrich all executives to get email and LinkedIn
        const enrichedExecutives = [];
        for (const executive of allExecutives) {
            try {
                const personId = executive.id || executive.person_id;
                const firstName = executive.first_name;
                const lastName = executive.last_name;
                const orgName = organizationData.name;

                // Enrich using people/match API
                const enrichedData = await enrichPersonInApollo(personId, firstName, lastName, orgName);

                enrichedExecutives.push({
                    name: executive.name,
                    role: executive.title,
                    email: enrichedData?.email || null,
                    linkedin_url: enrichedData?.linkedin_url || null,
                });
            } catch (error) {
                console.warn(`⚠️ Error enriching ${executive.name}:`, error);
                // Still add without enrichment
                enrichedExecutives.push({
                    name: executive.name,
                    role: executive.title,
                    email: null,
                    linkedin_url: null,
                });
            }
        }

        console.log(`✅ Enriched ${enrichedExecutives.length} executives:`, {
            withEmail: enrichedExecutives.filter(e => e.email).length,
            withLinkedIn: enrichedExecutives.filter(e => e.linkedin_url).length,
        });

        return enrichedExecutives;
    } catch (error) {
        console.error('❌ Error finding C-level executives:', error);
        throw error;
    }
}

/**
 * Find all C-level executives (CEO, President, Chair) at a company
 * This is the new simplified approach - just find all executives by role
 */
async function searchMultiplePeopleInApollo(companyName, decisionMakers, companyDomain = null) {
    // New approach: Find all CEOs, Presidents, and Chairs automatically
    // Ignore decisionMakers parameter (not used in new approach)
    try {
        const executives = await findAllCLevelExecutives(companyName, companyDomain);
        return executives;
    } catch (error) {
        console.error(`❌ Error finding C-level executives:`, error);
        return [];
    }
}


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
        // Step 1: Extract company name and domain from signal data
        console.log('🔍 Step 1: Extracting company name and domain from signal...');
        const extracted = await extractCompanyAndDomain(signalData);
        debug.llm_result = extracted;

        const companyName = extracted.company_name;
        const companyDomain = extracted.company_domain;

        debug.final_company_name = companyName;
        debug.final_company_domain = companyDomain;

        // Require at least company name or domain
        if (!companyName && !companyDomain) {
            console.log('⚠️ Missing required data for Apollo search:', {
                companyName: !!companyName,
                companyDomain: !!companyDomain,
            });
            return {
                ...signalData,
                apollo_enriched: false,
                apollo_error: 'Missing company name or domain',
                apollo_debug: debug,
                decision_maker_name: signalData.decision_maker_name || '',
                decision_maker_role: signalData.decision_maker_role || '',
                decision_maker_email: '',
                decision_maker_linkedin_url: signalData.decision_maker_linkedin_url || '',
                decision_maker_phone: '',
                all_decision_makers: '[]',
            };
        }

        // Step 2: Search Apollo for all CEOs, Presidents, and Chairs of the Board
        console.log('🔍 Step 2: Searching Apollo for all C-level executives (CEO, President, Chair)...', {
            companyName: companyName || 'Not provided',
            companyDomain: companyDomain || 'Not provided',
        });

        const enrichedDecisionMakers = await searchMultiplePeopleInApollo(companyName, [], companyDomain);
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

