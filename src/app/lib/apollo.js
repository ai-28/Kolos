import OpenAI from "openai";

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });


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

TASK: Extract the following information from the signal data below. These 3 fields are CRITICAL for Apollo API search:
1. Company name (organization_name) - The exact, official company/organization name mentioned in the signal
2. Person name (q_keywords) - Full name of decision makers/executives (first name + last name)
3. Role/Job title (person_titles) - Exact job title or role (e.g., "CEO", "CTO", "VP of Sales", "Director", "Chairman and Chief Executive Officer")

CRITICAL: Extract ALL THREE fields whenever possible. Use web search to find missing information.

SIGNAL DATA TO ANALYZE:
${combinedText}

INSTRUCTIONS FOR EXTRACTION:
- Use web search extensively to verify and find company names, person names, and job titles
- The source URL may contain additional information - use web search to fetch and analyze the page content if needed
- Look for specific company names, executive names, and their titles in the signal headline and next_step text
- The signal headline (headline_source) and next_step fields are the primary sources for finding decision maker information

FIELD REQUIREMENTS (must match Apollo API format):
1. company_name: 
   - Extract the EXACT, official company name (e.g., "Microsoft Corporation", "Apple Inc.")
   - Remove common suffixes like "Inc.", "LLC", "Corp" only if they're not part of the official name
   - Use web search to verify the official company name if ambiguous
   - Return null ONLY if absolutely no company is mentioned

2. decision_makers[].name:
   - Extract FULL names (first name + last name, e.g., "Thomas B. Pickens III", "John Smith")
   - Include middle names/initials if mentioned (e.g., "Thomas B. Pickens III" not "Thomas Pickens")
   - Use web search to find full names if only partial names are mentioned
   - If only a role is mentioned without a name, use web search to find the person in that role at the company

3. decision_makers[].role:
   - Extract EXACT job titles as mentioned (e.g., "Chairman and Chief Executive Officer", "VP of Sales", "CTO")
   - Preserve the exact wording - do not abbreviate or modify
   - Use web search to find the exact title if only a generic role is mentioned
   - If no specific role is mentioned but a person is named, use web search to find their current role

EXTRACTION PRIORITY:
1. If company is mentioned but no person: Use web search to find key executives (CEO, CTO, VP, etc.) at that company
2. If person is mentioned but no company: Use web search to find which company they work for
3. If role is mentioned but no person: Use web search to find the person in that role at the mentioned company
4. Extract ALL decision makers mentioned - if multiple people are mentioned, extract ALL of them

Return ONLY valid JSON in this exact format:
{
  "company_name": "Exact Company Name or null",
  "decision_makers": [
    {
      "name": "Full Name (First Last)",
      "role": "Exact Job Title"
    }
  ]
}

CRITICAL: 
- If company_name is null, still try to extract decision_makers (they may be searchable by name and role alone)
- If decision_makers is empty, still try to extract company_name (may be searchable by company alone)
- Always extract as many fields as possible - never return all null/empty unless absolutely no information exists
- Use web search to fill in missing information whenever possible

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
 * Search for organization in Apollo to get organization_id or domain
 * Uses Organization Search API: POST /api/v1/mixed_companies/search
 */
async function searchOrganizationInApollo(companyName) {
    if (!companyName || !process.env.APOLLO_API_KEY) {
        return null;
    }

    try {
        const searchBody = {
            page: 1,
            per_page: 1,
            q_organization_name: companyName,  // Search by company name
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
            const errorText = await searchResponse.text();
            console.warn(`⚠️ Organization search error: ${searchResponse.status} - ${errorText}`);
            return null;
        }

        const searchData = await searchResponse.json();
        const organizations = searchData.organizations || [];

        if (organizations.length > 0) {
            const org = organizations[0];
            return {
                organization_id: org.id || org.organization_id || null,
                domain: org.primary_domain || org.domain || null,
                name: org.name || companyName,
            };
        }

        return null;
    } catch (error) {
        console.warn('⚠️ Error searching organization:', error);
        return null;
    }
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
 * Enrich a person from search results and return contact info
 */
async function enrichPersonFromSearch(person, personName, companyName) {
    const personId = person.id || person.person_id || null;
    const firstName = person.first_name || (personName ? personName.split(' ')[0] : '') || '';
    const lastName = person.last_name || (personName ? personName.split(' ').slice(1).join(' ') : '') || '';

    let email = null;
    let linkedinUrl = null;

    if (personId) {
        const enrichedData = await enrichPersonInApollo(personId, firstName, lastName, companyName);
        if (enrichedData) {
            email = enrichedData.email;
            linkedinUrl = enrichedData.linkedin_url;
        }
    }

    // Fallback to search result data if enrichment didn't return values
    if (!email) email = person.email || null;
    if (!linkedinUrl) linkedinUrl = person.linkedin_url || null;

    return { email, linkedin_url: linkedinUrl };
}

/**
 * Sequential step-by-step search strategy using correct Apollo API parameters
 * Step 1: Company + Name + Role (all 3 fields) - using organization_ids or q_organization_domains_list
 * Step 2: Company + Role (using organization_ids or q_organization_domains_list)
 * Step 3: Name + Role
 * Step 4: Name only
 * Step 5: Simplified name variations
 */
async function searchPersonInApollo(companyName, personName, personRole) {
    if (!process.env.APOLLO_API_KEY) {
        throw new Error('APOLLO_API_KEY is not configured');
    }

    // At least one field should be provided
    if (!companyName && !personName && !personRole) {
        throw new Error('At least one of company name, person name, or role is required for Apollo search');
    }

    try {
        // First, search for organization if we have company name
        // This gives us organization_id or domain to use in people search
        let organizationData = null;
        if (companyName) {
            console.log(`🔍 Searching for organization: ${companyName}`);
            organizationData = await searchOrganizationInApollo(companyName);
            if (organizationData) {
                console.log(`✅ Found organization: ${organizationData.name} (ID: ${organizationData.organization_id || 'N/A'}, Domain: ${organizationData.domain || 'N/A'})`);
            } else {
                console.log(`⚠️ Organization not found: ${companyName}`);
            }
        }

        // STEP 1: Try all 3 fields (Company + Name + Role) - Best accuracy
        // If successful, returns immediately and skips all remaining steps
        if (companyName && personName && personRole) {
            console.log(`🔍 Step 1: Searching ${personName} (${personRole}) at ${companyName}`);
            const searchBody = {
                page: 1,
                per_page: 1,
                q_keywords: personName,
                person_titles: [personRole],
                include_similar_titles: true,  // Enable similar title matching
            };

            // Use organization_ids or q_organization_domains_list (correct API parameters)
            if (organizationData?.organization_id) {
                searchBody.organization_ids = [organizationData.organization_id];
                console.log(`📋 Step 1: Using organization_id: ${organizationData.organization_id}`);
            } else if (organizationData?.domain) {
                searchBody.q_organization_domains_list = [organizationData.domain];
                console.log(`📋 Step 1: Using domain: ${organizationData.domain}`);
            } else {
                // Fallback: try to extract domain from company name or use in q_keywords
                const domainMatch = companyName.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/i);
                if (domainMatch) {
                    searchBody.q_organization_domains_list = [domainMatch[1].toLowerCase()];
                    console.log(`📋 Step 1: Using extracted domain: ${domainMatch[1]}`);
                } else {
                    // Last resort: include company name in q_keywords (less accurate)
                    searchBody.q_keywords = `${personName} ${companyName}`;
                    console.log(`📋 Step 1: Using company name in q_keywords`);
                }
            }

            const people = await performApolloSearch(searchBody);
            if (people.length > 0) {
                // Verify company match
                const orgName = people[0].organization?.name || '';
                if (!companyName || orgName.toLowerCase().includes(companyName.toLowerCase()) ||
                    companyName.toLowerCase().includes(orgName.toLowerCase())) {
                    console.log(`✅ Step 1 SUCCESS: Found ${people[0].first_name} ${people[0].last_name}`);
                    return await enrichPersonFromSearch(people[0], personName, companyName);
                } else {
                    console.log(`⚠️ Step 1: Found person but company doesn't match`);
                }
            }
            console.log(`⚠️ Step 1 FAILED: No results with all 3 fields`);
        }

        // STEP 1.5: Try simplified name with all 3 fields (if Step 1 failed)
        // Apollo often stores names without middle initials/suffixes
        // "Thomas B. Pickens III" -> "Thomas Pickens"
        // If successful, returns immediately and skips all remaining steps
        if (companyName && personName && personRole) {
            const nameParts = personName.trim().split(/\s+/);
            if (nameParts.length > 2) { // Only simplify if name has more than 2 parts
                const firstName = nameParts[0];
                // Get last name correctly (skip suffixes like III, Jr, Sr, etc.)
                let lastName = nameParts[nameParts.length - 1];
                const suffixPattern = /^(III?|IV|VI?|VII?|VIII?|IX|X|Jr\.?|Sr\.?|II|2nd|3rd)$/i;
                if (suffixPattern.test(lastName)) {
                    lastName = nameParts[nameParts.length - 2];
                }
                const simplifiedName = `${firstName} ${lastName}`;

                if (simplifiedName !== personName && simplifiedName.split(' ').length === 2) {
                    console.log(`🔍 Step 1.5: Searching simplified name "${simplifiedName}" (${personRole}) at ${companyName}`);
                    const searchBody = {
                        page: 1,
                        per_page: 1,
                        q_keywords: simplifiedName,
                        person_titles: [personRole],
                        include_similar_titles: true,
                    };

                    // Use organization_ids or q_organization_domains_list
                    if (organizationData?.organization_id) {
                        searchBody.organization_ids = [organizationData.organization_id];
                        console.log(`📋 Step 1.5: Using organization_id: ${organizationData.organization_id}`);
                    } else if (organizationData?.domain) {
                        searchBody.q_organization_domains_list = [organizationData.domain];
                        console.log(`📋 Step 1.5: Using domain: ${organizationData.domain}`);
                    } else {
                        const domainMatch = companyName.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/i);
                        if (domainMatch) {
                            searchBody.q_organization_domains_list = [domainMatch[1].toLowerCase()];
                            console.log(`📋 Step 1.5: Using extracted domain: ${domainMatch[1]}`);
                        } else {
                            searchBody.q_keywords = `${simplifiedName} ${companyName}`;
                            console.log(`📋 Step 1.5: Using company name in q_keywords`);
                        }
                    }

                    const people = await performApolloSearch(searchBody);
                    if (people.length > 0) {
                        const orgName = people[0].organization?.name || '';
                        if (!companyName || orgName.toLowerCase().includes(companyName.toLowerCase()) ||
                            companyName.toLowerCase().includes(orgName.toLowerCase())) {
                            console.log(`✅ Step 1.5 SUCCESS: Found ${people[0].first_name} ${people[0].last_name} with simplified name`);
                            return await enrichPersonFromSearch(people[0], personName, companyName);
                        } else {
                            console.log(`⚠️ Step 1.5: Found person but company doesn't match`);
                        }
                    }
                    console.log(`⚠️ Step 1.5 FAILED: No results with simplified name`);
                }
            }
        }

        // STEP 1.6: Try simplified name + Company using people/match API (direct enrichment)
        // Uses people/match API to match and enrich in one call (no search needed)
        // If successful, returns immediately and skips all remaining steps
        if (companyName && personName) {
            const nameParts = personName.trim().split(/\s+/);
            if (nameParts.length > 2) { // Only simplify if name has more than 2 parts
                const firstName = nameParts[0];
                // Get last name correctly (skip suffixes like III, Jr, Sr, etc.)
                let lastName = nameParts[nameParts.length - 1];
                const suffixPattern = /^(III?|IV|VI?|VII?|VIII?|IX|X|Jr\.?|Sr\.?|II|2nd|3rd)$/i;
                if (suffixPattern.test(lastName)) {
                    lastName = nameParts[nameParts.length - 2];
                }
                const simplifiedName = `${firstName} ${lastName}`;

                if (simplifiedName !== personName && simplifiedName.split(' ').length === 2) {
                    console.log(`🔍 Step 1.6: Trying direct enrichment with simplified name "${simplifiedName}" at ${companyName} using people/match API`);

                    try {
                        const [first, last] = simplifiedName.split(' ');
                        const enrichBody = {
                            first_name: first,
                            last_name: last,
                            organization_name: companyName,
                            reveal_personal_emails: true,
                        };

                        // Use domain if available (more accurate than organization_name)
                        if (organizationData?.domain) {
                            enrichBody.domain = organizationData.domain;
                            delete enrichBody.organization_name;
                            console.log(`📋 Step 1.6: Using domain: ${organizationData.domain}`);
                        } else {
                            console.log(`📋 Step 1.6: Using organization_name: ${companyName}`);
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

                        if (enrichResponse.ok) {
                            const enrichData = await enrichResponse.json();
                            const person = enrichData.person || enrichData;

                            if (person && (person.email || person.linkedin_url)) {
                                // Verify company match
                                const orgName = person.organization?.name || '';
                                if (!companyName || orgName.toLowerCase().includes(companyName.toLowerCase()) ||
                                    companyName.toLowerCase().includes(orgName.toLowerCase())) {
                                    console.log(`✅ Step 1.6 SUCCESS: Found and enriched ${person.first_name || first} ${person.last_name || last} with simplified name`);
                                    return {
                                        email: person.email || null,
                                        linkedin_url: person.linkedin_url || null,
                                    };
                                } else {
                                    console.log(`⚠️ Step 1.6: Found person but company doesn't match`);
                                }
                            } else {
                                console.log(`⚠️ Step 1.6: Match found but no contact info available`);
                            }
                        } else {
                            const errorText = await enrichResponse.text();
                            console.log(`⚠️ Step 1.6 FAILED: ${enrichResponse.status} - ${errorText}`);
                        }
                    } catch (error) {
                        console.warn(`⚠️ Step 1.6 error:`, error);
                    }
                }
            }
        }

        // STEP 2: Try Company + Role (find whoever holds that position)
        // If successful, returns immediately and skips all remaining steps
        if (companyName && personRole) {
            console.log(`🔍 Step 2: Searching for ${personRole} at ${companyName} (company + role)`);
            const searchBody = {
                page: 1,
                per_page: 5, // Get multiple results to find best match
                person_titles: [personRole],
                include_similar_titles: true,  // Enable similar title matching (e.g., "CEO" matches "Chief Executive Officer")
            };

            // Use organization_ids or q_organization_domains_list (correct API parameters)
            if (organizationData?.organization_id) {
                searchBody.organization_ids = [organizationData.organization_id];
                console.log(`📋 Step 2: Using organization_id: ${organizationData.organization_id}`);
            } else if (organizationData?.domain) {
                searchBody.q_organization_domains_list = [organizationData.domain];
                console.log(`📋 Step 2: Using domain: ${organizationData.domain}`);
            } else {
                // Fallback: try to extract domain from company name
                const domainMatch = companyName.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/i);
                if (domainMatch) {
                    searchBody.q_organization_domains_list = [domainMatch[1].toLowerCase()];
                    console.log(`📋 Step 2: Using extracted domain: ${domainMatch[1]}`);
                } else {
                    // Last resort: use company name in q_keywords (less accurate)
                    searchBody.q_keywords = companyName;
                    console.log(`📋 Step 2: Using company name in q_keywords: ${companyName}`);
                }
            }

            const people = await performApolloSearch(searchBody);
            console.log(`📊 Step 2: Apollo returned ${people.length} result(s) for ${personRole} at ${companyName}`);

            if (people.length > 0) {
                // Log what we found
                people.forEach((p, idx) => {
                    console.log(`   ${idx + 1}. ${p.first_name || ''} ${p.last_name || ''} - ${p.title || 'No title'} at ${p.organization?.name || 'Unknown'}`);
                });

                // Filter results to match company name if we don't have organization_id
                let matchingPeople = people;
                if (!organizationData?.organization_id) {
                    matchingPeople = people.filter(p => {
                        const orgName = p.organization?.name || '';
                        return orgName.toLowerCase().includes(companyName.toLowerCase()) ||
                            companyName.toLowerCase().includes(orgName.toLowerCase());
                    });
                    console.log(`📊 Step 2: After company filter: ${matchingPeople.length} matching results`);
                }

                if (matchingPeople.length > 0) {
                    // Select best match
                    let person = matchingPeople[0];
                    if (matchingPeople.length > 1 && personName) {
                        // If we have a name, try to match it
                        const nameMatch = matchingPeople.find(p => {
                            const fullName = `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase();
                            return fullName.includes(personName.toLowerCase()) ||
                                personName.toLowerCase().includes(fullName);
                        });
                        if (nameMatch) person = nameMatch;
                    } else if (matchingPeople.length > 1) {
                        // Find exact role match
                        const exactMatch = matchingPeople.find(p =>
                            p.title && p.title.toLowerCase().includes(personRole.toLowerCase())
                        );
                        if (exactMatch) person = exactMatch;
                    }

                    console.log(`✅ Step 2 SUCCESS: Found ${person.first_name} ${person.last_name} (${person.title || personRole})`);
                    return await enrichPersonFromSearch(person, personName, companyName);
                }
            }
            console.log(`⚠️ Step 2 FAILED: No ${personRole} found at ${companyName}`);
        }

        // STEP 3: Try Name + Role (if company is missing or doesn't match)
        // If successful, returns immediately and skips Step 4, 4.5, and 5
        if (personName && personRole) {
            console.log(`🔍 Step 3: Searching ${personName} with role ${personRole} (name + role)`);
            const searchBody = {
                page: 1,
                per_page: 1,
                q_keywords: personName,
                person_titles: [personRole],
                include_similar_titles: true,  // Enable similar title matching
            };

            const people = await performApolloSearch(searchBody);
            if (people.length > 0) {
                // Verify company match if we have company name
                if (companyName) {
                    const orgName = people[0].organization?.name || '';
                    const orgMatch = orgName.toLowerCase().includes(companyName.toLowerCase()) ||
                        companyName.toLowerCase().includes(orgName.toLowerCase());
                    if (orgMatch) {
                        console.log(`✅ Step 3 SUCCESS: Found ${people[0].first_name} ${people[0].last_name} (company matches)`);
                        return await enrichPersonFromSearch(people[0], personName, companyName);
                    } else {
                        console.log(`⚠️ Step 3: Found person but company doesn't match, continuing to next step`);
                    }
                } else {
                    console.log(`✅ Step 3 SUCCESS: Found ${people[0].first_name} ${people[0].last_name}`);
                    return await enrichPersonFromSearch(people[0], personName, companyName);
                }
            }
            console.log(`⚠️ Step 3 FAILED: No results for ${personName} with role ${personRole}`);
        }

        // STEP 4: Try Name only
        // If successful, returns immediately and skips Step 4.5 and 5
        if (personName) {
            console.log(`🔍 Step 4: Searching ${personName} (name only)`);
            const searchBody = {
                page: 1,
                per_page: 1,
                q_keywords: personName,
            };

            const people = await performApolloSearch(searchBody);
            if (people.length > 0) {
                // Verify company match if we have company name
                if (companyName) {
                    const orgName = people[0].organization?.name || '';
                    const orgMatch = orgName.toLowerCase().includes(companyName.toLowerCase()) ||
                        companyName.toLowerCase().includes(orgName.toLowerCase());
                    if (orgMatch) {
                        console.log(`✅ Step 4 SUCCESS: Found ${people[0].first_name} ${people[0].last_name} (company matches)`);
                        return await enrichPersonFromSearch(people[0], personName, companyName);
                    } else {
                        console.log(`⚠️ Step 4: Found person but company doesn't match`);
                    }
                } else {
                    console.log(`✅ Step 4 SUCCESS: Found ${people[0].first_name} ${people[0].last_name}`);
                    return await enrichPersonFromSearch(people[0], personName, companyName);
                }
            }
            console.log(`⚠️ Step 4 FAILED: No results for ${personName}`);

            // Step 4.5: Try simplified name (if Step 4 failed and name has multiple parts)
            const nameParts = personName.trim().split(/\s+/);
            if (nameParts.length > 2) {
                const firstName = nameParts[0];
                let lastName = nameParts[nameParts.length - 1];
                const suffixPattern = /^(III?|IV|VI?|VII?|VIII?|IX|X|Jr\.?|Sr\.?|II|2nd|3rd)$/i;
                if (suffixPattern.test(lastName)) {
                    lastName = nameParts[nameParts.length - 2];
                }
                const simplifiedName = `${firstName} ${lastName}`;

                if (simplifiedName !== personName && simplifiedName.split(' ').length === 2) {
                    console.log(`🔍 Step 4.5: Searching simplified name "${simplifiedName}" (name only)`);
                    const searchBody = {
                        page: 1,
                        per_page: 1,
                        q_keywords: simplifiedName,
                    };

                    // Use organization_ids or q_organization_domains_list if available
                    if (companyName) {
                        if (organizationData?.organization_id) {
                            searchBody.organization_ids = [organizationData.organization_id];
                        } else if (organizationData?.domain) {
                            searchBody.q_organization_domains_list = [organizationData.domain];
                        }
                    }

                    const people = await performApolloSearch(searchBody);
                    if (people.length > 0) {
                        // Verify company match if we have company name
                        if (companyName) {
                            const orgName = people[0].organization?.name || '';
                            const orgMatch = orgName.toLowerCase().includes(companyName.toLowerCase()) ||
                                companyName.toLowerCase().includes(orgName.toLowerCase());
                            if (orgMatch) {
                                console.log(`✅ Step 4.5 SUCCESS: Found ${people[0].first_name} ${people[0].last_name} with simplified name (company matches)`);
                                return await enrichPersonFromSearch(people[0], personName, companyName);
                            } else {
                                console.log(`⚠️ Step 4.5: Found person but company doesn't match`);
                            }
                        } else {
                            console.log(`✅ Step 4.5 SUCCESS: Found ${people[0].first_name} ${people[0].last_name} with simplified name`);
                            return await enrichPersonFromSearch(people[0], personName, companyName);
                        }
                    }
                    console.log(`⚠️ Step 4.5 FAILED: No results for simplified name`);
                }
            }
        }

        console.log(`❌ All search steps exhausted - no contact info found`);
        return {
            email: null,
            linkedin_url: null,
        };
    } catch (error) {
        console.error('❌ Error searching Apollo:', error);
        throw error;
    }
}


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
            });
        } catch (error) {
            console.error(`❌ Error searching Apollo for ${decisionMaker.name}:`, error);
            // Continue with other decision makers even if one fails
            enrichedDecisionMakers.push({
                name: decisionMaker.name,
                role: decisionMaker.role || null,
                email: null,
                linkedin_url: null,
                error: error.message,
            });
        }
    }

    return enrichedDecisionMakers;
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
        // Step 1: Extract company name and decision makers from signal data
        console.log('🔍 Step 1: Extracting company and decision makers info from signal...');
        const extracted = await extractCompanyAndDecisionMaker(signalData);
        debug.llm_result = extracted;

        const companyName = extracted.company_name;
        const decisionMakers = extracted.decision_makers || [];

        debug.final_company_name = companyName;
        debug.final_decision_maker_name = decisionMakers.length > 0 ? decisionMakers[0].name : null;
        debug.final_decision_maker_role = decisionMakers.length > 0 ? decisionMakers[0].role : null;

        // Only require decision makers (company name is optional)
        if (decisionMakers.length === 0) {
            console.log('⚠️ Missing required data for Apollo search:', {
                companyName: !!companyName,
                decisionMakersCount: decisionMakers.length,
            });
            return {
                ...signalData,
                apollo_enriched: false,
                apollo_error: 'Missing decision makers',
                apollo_debug: debug,
                decision_maker_name: signalData.decision_maker_name || '',
                decision_maker_role: signalData.decision_maker_role || '',
                decision_maker_email: '',
                decision_maker_linkedin_url: signalData.decision_maker_linkedin_url || '',
                decision_maker_phone: '',
                all_decision_makers: JSON.stringify(decisionMakers),
            };
        }

        // Step 2: Search Apollo for all decision makers (even without company name)
        console.log('🔍 Step 2: Searching Apollo for decision makers...', {
            companyName: companyName || 'Not provided',
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

