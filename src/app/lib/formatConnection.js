/**
 * Format connection data from Google Sheets to match API response format
 * Ensures consistent data structure for SSE events
 */

// Helper function to convert Google Sheets boolean values to actual booleans
function toBoolean(value) {
    if (value === true || value === false) return value;
    if (typeof value === 'string') {
        const lower = value.toLowerCase().trim();
        return lower === 'true' || lower === '1' || lower === 'yes';
    }
    return false;
}

/**
 * Format a single connection object from Google Sheets
 * @param {Object} conn - Raw connection data from Google Sheets
 * @returns {Object} Formatted connection data
 */
export function formatConnection(conn) {
    if (!conn) return null;

    // Get raw values for boolean fields
    const rawAdminApproved = conn.admin_approved || conn['admin_approved'] || conn['Admin Approved'] || false;
    const rawClientApproved = conn.client_approved || conn['client_approved'] || conn['Client Approved'] || false;
    const rawAdminFinalApproved = conn.admin_final_approved || conn['admin_final_approved'] || conn['Admin Final Approved'] || false;
    const rawDraftLocked = conn.draft_locked || conn['draft_locked'] || conn['Draft Locked'] || false;

    return {
        connection_id: conn.connection_id || conn['connection_id'] || conn['Connection ID'],
        from_user_id: conn.from_user_id || conn['from_user_id'] || conn['From User ID'],
        to_user_id: conn.to_user_id || conn['to_user_id'] || conn['To User ID'],
        deal_id: conn.deal_id || conn['deal_id'] || conn['Deal ID'],
        from_user_name: conn.from_user_name || conn['from_user_name'] || conn['From User Name'],
        to_user_name: conn.to_user_name || conn['to_user_name'] || conn['To User Name'],
        from_user_email: conn.from_user_email || conn['from_user_email'] || conn['From User Email'],
        to_user_email: conn.to_user_email || conn['to_user_email'] || conn['To User Email'],
        from_user_linkedin: conn.from_user_linkedin || conn['from_user_linkedin'] || conn['From User LinkedIn'],
        to_user_linkedin: conn.to_user_linkedin || conn['to_user_linkedin'] || conn['To User LinkedIn'],
        connection_type: conn.connection_type || conn['connection_type'] || conn['Connection Type'],
        status: conn.status || conn['status'] || conn['Status'],
        requested_at: conn.requested_at || conn['requested_at'] || conn['Requested At'],
        // Properly convert boolean values
        admin_approved: toBoolean(rawAdminApproved),
        draft_message: conn.draft_message || conn['draft_message'] || conn['Draft Message'] || '',
        draft_generated_at: conn.draft_generated_at || conn['draft_generated_at'] || conn['Draft Generated At'] || '',
        client_approved: toBoolean(rawClientApproved),
        client_approved_at: conn.client_approved_at || conn['client_approved_at'] || conn['Client Approved At'] || '',
        admin_final_approved: toBoolean(rawAdminFinalApproved),
        draft_locked: toBoolean(rawDraftLocked),
        client_goals: conn.client_goals || conn['client_goals'] || conn['Client Goals'] || '',
        related_signal_id: conn.related_signal_id || conn['related_signal_id'] || conn['Related Signal ID'] || '',
    };
}

