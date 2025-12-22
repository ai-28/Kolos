/**
 * Apollo.io API integration for contact enrichment
 * Documentation: https://apolloio.github.io/apollo-api-docs/
 * 
 * Required Environment Variable:
 * - APOLLO_API_KEY: Your Apollo.io API key (get from https://app.apollo.io/#/settings/integrations)
 * 
 * API Endpoint Used:
 * - /v1/contacts/search (requires api/v1/contacts/search permission)
 * 
 * Best practices:
 * - Rate limiting to avoid API limits (500ms delay between requests)
 * - Graceful error handling with fallbacks
 * - Intelligent company name extraction from URLs and headlines
 * - LLM-based extraction when pattern matching fails
 * - Caching to reduce API calls (24 hour TTL)
 * - Non-blocking: if Apollo fails, original signal data is preserved
 */

import OpenAI from "openai";

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_BASE_URL = 'https://api.apollo.io/v1';
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// Rate limiting: Apollo typically allows 120 requests per minute
// We'll be conservative and add delays between requests
const RATE_LIMIT_DELAY_MS = 500; // 500ms between requests = ~120 requests/minute
let lastRequestTime = 0;

// Simple in-memory cache to avoid duplicate API calls
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Rate-limited delay between Apollo API requests
 */
async function rateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS - timeSinceLastRequest));
  }

  lastRequestTime = Date.now();
}

/**
 * Generate cache key for Apollo search
 */
function getCacheKey(name, companyName, jobTitle) {
  return `${name || ''}|${companyName || ''}|${jobTitle || ''}`.toLowerCase().trim();
}

/**
 * Extract decision maker role from signal context (next_step, headline)
 * Tries to infer the role from the action described
 * Falls back to LLM extraction if pattern matching fails
 */
export async function extractDecisionMakerRoleFromSignal(signal) {
  // Strategy 1: Extract from next_step
  if (signal.next_step) {
    const nextStep = signal.next_step.toLowerCase();

    // Common role patterns in next_step
    const rolePatterns = [
      { pattern: /\b(ceo|chief executive officer)\b/i, role: 'CEO' },
      { pattern: /\b(cfo|chief financial officer)\b/i, role: 'CFO' },
      { pattern: /\b(cto|chief technology officer)\b/i, role: 'CTO' },
      { pattern: /\b(chro|chief human resources officer|hr director|hr head)\b/i, role: 'HR Director' },
      { pattern: /\b(coo|chief operating officer)\b/i, role: 'COO' },
      { pattern: /\b(cmo|chief marketing officer)\b/i, role: 'CMO' },
      { pattern: /\b(vp|vice president|vice-president)\b/i, role: 'VP' },
      { pattern: /\b(director|director of)\b/i, role: 'Director' },
      { pattern: /\b(manager|managing director)\b/i, role: 'Manager' },
      { pattern: /\b(executive|exec)\b/i, role: 'Executive' },
      { pattern: /\b(founder|co-founder)\b/i, role: 'Founder' },
      { pattern: /\b(president)\b/i, role: 'President' },
    ];

    for (const { pattern, role } of rolePatterns) {
      if (pattern.test(nextStep)) {
        return role;
      }
    }
  }

  // Strategy 2: Extract from headline_source
  if (signal.headline_source) {
    const headline = signal.headline_source.toLowerCase();

    const rolePatterns = [
      { pattern: /\b(ceo|chief executive officer)\b/i, role: 'CEO' },
      { pattern: /\b(cfo|chief financial officer)\b/i, role: 'CFO' },
      { pattern: /\b(cto|chief technology officer)\b/i, role: 'CTO' },
      { pattern: /\b(chro|chief human resources officer|hr director)\b/i, role: 'HR Director' },
      { pattern: /\b(coo|chief operating officer)\b/i, role: 'COO' },
      { pattern: /\b(cmo|chief marketing officer)\b/i, role: 'CMO' },
      { pattern: /\b(vp|vice president)\b/i, role: 'VP' },
      { pattern: /\b(director|director of)\b/i, role: 'Director' },
      { pattern: /\b(executive|exec)\b/i, role: 'Executive' },
      { pattern: /\b(founder|co-founder)\b/i, role: 'Founder' },
    ];

    for (const { pattern, role } of rolePatterns) {
      if (pattern.test(headline)) {
        return role;
      }
    }
  }

  // Strategy 3: Use LLM if pattern matching failed
  const llmResult = await extractWithLLM(signal);
  return llmResult.role || null;
}

/**
 * Use LLM to extract company name and decision maker role from signal data
 * Analyzes all available context to intelligently determine company and role
 * 
 * @param {Object} signal - Signal object with headline, url, next_step
 * @returns {Promise<Object>} - { companyName: string|null, role: string|null }
 */
async function extractWithLLM(signal) {
  if (!openai) {
    return { companyName: null, role: null };
  }

  try {
    // Extract domain from URL if available
    let urlDomain = null;
    if (signal.url) {
      try {
        const url = new URL(signal.url);
        urlDomain = url.hostname.replace('www.', '');
      } catch (e) {
        // URL parsing failed, use as-is
        urlDomain = signal.url;
      }
    }

    const prompt = `Analyze the following business signal information and extract the company name and decision maker role.

Headline: ${signal.headline_source || 'N/A'}
URL: ${signal.url || 'N/A'}
URL Domain: ${urlDomain || 'N/A'}
Next Step: ${signal.next_step || 'N/A'}

Return ONLY a valid JSON object with this exact structure:
{
  "companyName": "Company Name or null",
  "role": "Decision Maker Role (e.g., CEO, CFO, HR Director) or null"
}

Rules:
- Extract the ACTUAL COMPANY NAME that is the subject of this business opportunity
- If the URL is a news site (like reuters.com, bloomberg.com, techcrunch.com, etc.), extract the company name mentioned in the headline/content, NOT the news site name
- If the URL is the company's own website, extract the company name from the domain
- Extract the most relevant decision maker role for this opportunity based on the context
- Return null if you cannot determine with confidence
- Do not include any explanation, only the JSON object`;

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      messages: [
        {
          role: "system",
          content: "You are a data extraction assistant. Analyze business signals to extract company names and decision maker roles. Return only valid JSON, no markdown, no explanations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      return { companyName: null, role: null };
    }

    // Remove markdown code blocks if present
    const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonContent);

    return {
      companyName: parsed.companyName || null,
      role: parsed.role || null,
    };
  } catch (error) {
    console.error('Error in LLM extraction:', error.message);
    return { companyName: null, role: null };
  }
}

/**
 * Extract company name from signal context
 * Uses intelligent LLM-based extraction that analyzes all available context
 * Falls back to pattern matching for fast extraction when possible
 */
export async function extractCompanyNameFromSignal(signal) {
  // Strategy 1: Quick pattern matching from headline (fast, free)
  // Only use if we have a clear pattern match
  if (signal.headline_source) {
    const headline = signal.headline_source;

    // Pattern 1: "Company Name announces..." or "Company Name raises..."
    const announcePattern = /^([A-Z][a-zA-Z0-9\s&]+?)\s+(announces|raises|launches|expands|hires|acquires|opens|closes|plans|reports)/i;
    let match = headline.match(announcePattern);
    if (match && match[1]) {
      const company = match[1].trim();
      // Filter out common false positives
      if (company.length > 2 && company.length < 50 &&
        !company.toLowerCase().includes('mass') &&
        !company.toLowerCase().includes('wave') &&
        !company.toLowerCase().includes('layoff')) {
        // Quick validation: if it looks like a valid company name, return it
        // Otherwise, let LLM handle it for better accuracy
        if (company.split(' ').length <= 5) { // Reasonable company name length
          return company;
        }
      }
    }

    // Pattern 2: "at Company Name" or "from Company Name"
    const atPattern = /(?:at|from|by)\s+([A-Z][a-zA-Z0-9\s&]+?)(?:\s|$|,|\.)/i;
    match = headline.match(atPattern);
    if (match && match[1]) {
      const company = match[1].trim();
      if (company.length > 2 && company.length < 50 && company.split(' ').length <= 5) {
        return company;
      }
    }

    // Pattern 3: Company name in quotes or parentheses
    const quotedPattern = /["']([A-Z][a-zA-Z0-9\s&]+?)(?:["']|$)/;
    match = headline.match(quotedPattern);
    if (match && match[1]) {
      const company = match[1].trim();
      if (company.length > 2 && company.length < 50 && company.split(' ').length <= 5) {
        return company;
      }
    }
  }

  // Strategy 2: Use LLM for intelligent extraction
  // LLM can analyze URL, headline, and next_step together to determine:
  // - If URL is a news site, extract company from headline
  // - If URL is company's own site, extract from domain
  // - Handle edge cases and ambiguous situations
  const llmResult = await extractWithLLM(signal);
  return llmResult.companyName || null;
}

/**
 * Search for a person in Apollo by name, company, and role
 * @param {Object} params - Search parameters
 * @param {string} params.name - Person's name (optional)
 * @param {string} params.companyName - Company name
 * @param {string} params.jobTitle - Job title/role
 * @returns {Promise<Object|null>} - Apollo person data or null if not found
 */
async function searchPersonInApollo({ name, companyName, jobTitle }) {
  if (!APOLLO_API_KEY) {
    console.warn('⚠️ APOLLO_API_KEY not set, skipping Apollo enrichment');
    return null;
  }

  if (!companyName && !name) {
    return null; // Need at least company or name to search
  }

  // Check cache first
  const cacheKey = getCacheKey(name, companyName, jobTitle);
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  // Rate limiting
  await rateLimit();

  try {
    // Build search query
    const searchParams = {
      api_key: APOLLO_API_KEY,
      page: 1,
      per_page: 1,
    };

    if (name) {
      // Split name into first and last if possible
      const nameParts = name.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        searchParams.first_name = nameParts[0];
        searchParams.last_name = nameParts.slice(1).join(' ');
      } else {
        searchParams.q_keywords = name;
      }
    }

    if (companyName) {
      searchParams.organization_name = companyName;
    }

    if (jobTitle) {
      searchParams.person_titles = [jobTitle];
    }

    // Use /v1/contacts/search endpoint (available in user's Apollo plan)
    const response = await fetch(`${APOLLO_BASE_URL}/contacts/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': APOLLO_API_KEY,
      },
      body: JSON.stringify(searchParams),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Apollo API error (${response.status}):`, errorText);

      // Don't throw - return null to allow fallback to original data
      return null;
    }

    const data = await response.json();

    // /v1/contacts/search returns contacts in 'contacts' array (or 'people' array depending on version)
    const contacts = data.contacts || data.people || [];
    if (contacts.length > 0) {
      const person = contacts[0];
      const result = {
        name: person.first_name && person.last_name
          ? `${person.first_name} ${person.last_name}`
          : person.name || name,
        linkedin_url: person.linkedin_url || null,
        email: person.email || null,
        phone_number: person.phone_numbers && person.phone_numbers.length > 0
          ? person.phone_numbers[0].raw_number
          : null,
        title: person.title || jobTitle,
        company: person.organization?.name || companyName,
      };

      // Cache the result
      cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      return result;
    }

    // Cache null result to avoid repeated failed searches
    cache.set(cacheKey, {
      data: null,
      timestamp: Date.now(),
    });

    return null;
  } catch (error) {
    console.error('Error searching Apollo:', error.message);
    // Don't throw - return null to allow fallback
    return null;
  }
}

/**
 * Enrich a signal with Apollo contact information
 * This is the main function to use for enriching signals
 * 
 * @param {Object} signal - Signal object with decision maker info
 * @param {string} signal.decision_maker_name - Decision maker name
 * @param {string} signal.decision_maker_role - Decision maker role
 * @param {string} signal.headline_source - Signal headline (may contain company name)
 * @param {string} signal.url - Signal URL (may contain company domain)
 * @returns {Promise<Object>} - Enriched signal with valid contact info
 */
export async function enrichSignalWithApollo(signal) {
  // Skip if Apollo API key is not configured
  if (!APOLLO_API_KEY) {
    return {
      ...signal,
      apollo_enriched: false,
      apollo_error: 'API key not configured',
    };
  }

  // Extract company name from signal
  const companyName = await extractCompanyNameFromSignal(signal);

  // Extract decision maker role from signal if not provided
  let decisionMakerRole = signal.decision_maker_role;
  if (!decisionMakerRole || decisionMakerRole === 'TBD' || decisionMakerRole.trim() === '' || decisionMakerRole === 'N/A') {
    decisionMakerRole = await extractDecisionMakerRoleFromSignal(signal) || 'Executive Leadership';
  }

  // Need at least company name to search
  if (!companyName) {
    return {
      ...signal,
      apollo_enriched: false,
      apollo_error: 'Insufficient data for search - need company name',
    };
  }

  // If we have a name, search with it
  // If not, search by role and company
  if (!signal.decision_maker_name || signal.decision_maker_name === 'TBD' || signal.decision_maker_name.trim() === '' || signal.decision_maker_name === 'N/A') {
    // Try to find decision maker by role and company
    if (companyName && decisionMakerRole) {
      const apolloData = await searchPersonInApollo({
        name: null,
        companyName: companyName,
        jobTitle: decisionMakerRole,
      });

      if (apolloData) {
        return {
          ...signal,
          decision_maker_name: apolloData.name || signal.decision_maker_name || '',
          decision_maker_linkedin_url: apolloData.linkedin_url || signal.decision_maker_linkedin_url || '',
          decision_maker_email: apolloData.email || '',
          decision_maker_phone: apolloData.phone_number || '',
          decision_maker_role: apolloData.title || decisionMakerRole,
          apollo_enriched: true,
          apollo_company: companyName,
        };
      }
    }

    return {
      ...signal,
      apollo_enriched: false,
      apollo_error: 'No decision maker found in Apollo',
    };
  }

  // Search Apollo with available information
  const apolloData = await searchPersonInApollo({
    name: signal.decision_maker_name,
    companyName: companyName,
    jobTitle: decisionMakerRole,
  });

  if (apolloData && apolloData.linkedin_url) {
    // Successfully found valid LinkedIn URL
    return {
      ...signal,
      decision_maker_name: apolloData.name || signal.decision_maker_name,
      decision_maker_linkedin_url: apolloData.linkedin_url,
      decision_maker_email: apolloData.email || '',
      decision_maker_phone: apolloData.phone_number || '',
      decision_maker_role: apolloData.title || decisionMakerRole,
      apollo_enriched: true,
      apollo_company: apolloData.company || companyName,
    };
  }

  // Apollo search didn't find a match, return original signal
  // but keep the original LinkedIn URL if it exists (might be valid)
  return {
    ...signal,
    apollo_enriched: false,
    apollo_error: apolloData === null ? 'No match found in Apollo' : 'No LinkedIn URL in Apollo result',
  };
}

/**
 * Enrich deal data with Apollo contact information
 * Used when a deal is created from a signal
 * 
 * @param {Object} dealData - Deal data with signal information
 * @param {string} dealData.deal_name - Deal name (from headline_source)
 * @param {string} dealData.source - Source URL
 * @param {string} dealData.next_step - Next step action
 * @returns {Promise<Object>} - Deal data enriched with decision maker info
 */
export async function enrichDealWithApollo(dealData) {
  // Skip if Apollo API key is not configured
  if (!APOLLO_API_KEY) {
    return {
      ...dealData,
      apollo_enriched: false,
      apollo_error: 'API key not configured',
    };
  }

  // Create a signal-like object from deal data
  const signalData = {
    headline_source: dealData.deal_name || '',
    url: dealData.source || '',
    next_step: dealData.next_step || '',
    decision_maker_name: dealData.decision_maker_name || '',
    decision_maker_role: dealData.decision_maker_role || '',
    decision_maker_linkedin_url: dealData.decision_maker_linkedin_url || '',
  };

  // Enrich using the signal enrichment function
  const enriched = await enrichSignalWithApollo(signalData);

  // Return deal data with enriched decision maker info
  return {
    ...dealData,
    decision_maker_name: enriched.decision_maker_name || dealData.decision_maker_name || '',
    decision_maker_role: enriched.decision_maker_role || dealData.decision_maker_role || '',
    decision_maker_linkedin_url: enriched.decision_maker_linkedin_url || dealData.decision_maker_linkedin_url || '',
    decision_maker_email: enriched.decision_maker_email || dealData.decision_maker_email || '',
    decision_maker_phone: enriched.decision_maker_phone || dealData.decision_maker_phone || '',
    apollo_enriched: enriched.apollo_enriched || false,
    apollo_error: enriched.apollo_error || null,
  };
}


