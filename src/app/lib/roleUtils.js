/**
 * Normalize role from complex strings to standard role names
 * Handles sentences like "I am an Investor" or "Managing Partner and Investor"
 */
export function normalizeRole(roleString) {
  if (!roleString || typeof roleString !== 'string') return "Investor"
  
  const roleLower = roleString.toLowerCase().trim()
  
  // Check for Admin first
  if (roleLower.includes('admin') || roleLower.includes('administrator')) {
    return "Admin"
  }
  
  // Check for Facilitator (check first as it's more specific)
  if (roleLower.includes('facilitator')) {
    return "Facilitator"
  }
  
  // Check for Entrepreneur (includes founder, cofounder, etc.)
  if (roleLower.includes('entrepreneur') || 
      roleLower.includes('founder') || 
      roleLower.includes('cofounder') ||
      roleLower.includes('co-founder')) {
    return "Entrepreneur"
  }
  
  // Check for Asset Manager (includes managing partner, etc.)
  if (roleLower.includes('asset manager') || 
      roleLower.includes('managing partner') ||
      roleLower.includes('assetmanager')) {
    return "Asset Manager"
  }
  
  // Check for Investor
  if (roleLower.includes('investor')) {
    return "Investor"
  }
  
  // Default to Investor if no match
  return "Investor"
}

