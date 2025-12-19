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
 * - Caching to reduce API calls (24 hour TTL)
 * - Non-blocking: if Apollo fails, original signal data is preserved
 */

const APOLLO_API_KEY = process.env.APOLLO_API_KEY;
const APOLLO_BASE_URL = 'https://api.apollo.io/v1';

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
 * Extract company name from signal context
 * Tries multiple strategies to find the company name
 */
export function extractCompanyNameFromSignal(signal) {
  // Strategy 1: Extract from URL domain
  if (signal.url) {
    try {
      const url = new URL(signal.url);
      const hostname = url.hostname.replace('www.', '');
      
      // Skip common news domains
      const newsDomains = ['reuters.com', 'bloomberg.com', 'techcrunch.com', 
                          'wsj.com', 'forbes.com', 'cnbc.com', 'bbc.com',
                          'linkedin.com', 'twitter.com', 'facebook.com'];
      
      if (!newsDomains.some(domain => hostname.includes(domain))) {
        // Extract company name from domain (first part before TLD)
        const domainParts = hostname.split('.');
        if (domainParts.length >= 2) {
          const companyPart = domainParts[0];
          // Capitalize properly
          return companyPart.charAt(0).toUpperCase() + companyPart.slice(1);
        }
      }
    } catch (e) {
      // URL parsing failed, continue to next strategy
    }
  }

  // Strategy 2: Extract from headline_source using common patterns
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
        return company;
      }
    }

    // Pattern 2: "at Company Name" or "from Company Name"
    const atPattern = /(?:at|from|by)\s+([A-Z][a-zA-Z0-9\s&]+?)(?:\s|$|,|\.)/i;
    match = headline.match(atPattern);
    if (match && match[1]) {
      const company = match[1].trim();
      if (company.length > 2 && company.length < 50) {
        return company;
      }
    }

    // Pattern 3: Company name in quotes or parentheses
    const quotedPattern = /["']([A-Z][a-zA-Z0-9\s&]+?)["']/;
    match = headline.match(quotedPattern);
    if (match && match[1]) {
      const company = match[1].trim();
      if (company.length > 2 && company.length < 50) {
        return company;
      }
    }
  }

  return null;
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
  const companyName = extractCompanyNameFromSignal(signal);
  
  // Need at least company name or decision maker name to search
  if (!companyName && !signal.decision_maker_name) {
    return {
      ...signal,
      apollo_enriched: false,
      apollo_error: 'Insufficient data for search',
    };
  }

  // If we have a name, search with it
  // If not, we could search by role and company, but that's less reliable
  if (!signal.decision_maker_name || signal.decision_maker_name === 'TBD' || signal.decision_maker_name.trim() === '') {
    // Try to find decision maker by role and company
    if (companyName && signal.decision_maker_role) {
      const apolloData = await searchPersonInApollo({
        name: null,
        companyName: companyName,
        jobTitle: signal.decision_maker_role,
      });

      if (apolloData) {
        return {
          ...signal,
          decision_maker_name: apolloData.name || signal.decision_maker_name,
          decision_maker_linkedin_url: apolloData.linkedin_url || signal.decision_maker_linkedin_url || '',
          decision_maker_email: apolloData.email || '',
          decision_maker_phone: apolloData.phone_number || '',
          decision_maker_role: apolloData.title || signal.decision_maker_role,
          apollo_enriched: true,
          apollo_company: companyName,
        };
      }
    }

    return {
      ...signal,
      apollo_enriched: false,
      apollo_error: 'No decision maker name available',
    };
  }

  // Search Apollo with available information
  const apolloData = await searchPersonInApollo({
    name: signal.decision_maker_name,
    companyName: companyName,
    jobTitle: signal.decision_maker_role,
  });

  if (apolloData && apolloData.linkedin_url) {
    // Successfully found valid LinkedIn URL
    return {
      ...signal,
      decision_maker_name: apolloData.name || signal.decision_maker_name,
      decision_maker_linkedin_url: apolloData.linkedin_url,
      decision_maker_email: apolloData.email || '',
      decision_maker_phone: apolloData.phone_number || '',
      decision_maker_role: apolloData.title || signal.decision_maker_role,
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
 * Batch enrich multiple signals with Apollo
 * Includes rate limiting and error handling
 * 
 * @param {Array<Object>} signals - Array of signal objects
 * @returns {Promise<Array<Object>>} - Array of enriched signals
 */
export async function enrichSignalsBatch(signals) {
  if (!APOLLO_API_KEY || !signals || signals.length === 0) {
    return signals;
  }

  const enrichedSignals = [];
  let enrichedCount = 0;
  let errorCount = 0;

  for (const signal of signals) {
    try {
      const enriched = await enrichSignalWithApollo(signal);
      enrichedSignals.push(enriched);
      
      if (enriched.apollo_enriched) {
        enrichedCount++;
      } else if (enriched.apollo_error) {
        errorCount++;
      }
    } catch (error) {
      console.error('Error enriching signal with Apollo:', error);
      // Add original signal if enrichment fails
      enrichedSignals.push({
        ...signal,
        apollo_enriched: false,
        apollo_error: error.message,
      });
      errorCount++;
    }
  }

  console.log(`📊 Apollo enrichment: ${enrichedCount} enriched, ${errorCount} errors, ${signals.length - enrichedCount - errorCount} skipped`);

  return enrichedSignals;
}

