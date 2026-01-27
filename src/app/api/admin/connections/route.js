import { NextResponse } from "next/server";
import { getAllConnections, SHEETS } from "@/app/lib/googleSheets";
import { requireAuth } from "@/app/lib/session";
import { normalizeRole } from "@/app/lib/roleUtils";

/**
 * GET /api/admin/connections
 * Get all connection requests (admin only)
 */
export async function GET(request) {
    try {
        const session = await requireAuth();
        const userRole = session.role || '';

        // Check if user is admin
        const normalizedRole = normalizeRole(userRole);
        if (normalizedRole !== 'Admin') {
            return NextResponse.json(
                { error: "Forbidden: Admin access required" },
                { status: 403 }
            );
        }

        // Get query parameters
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status'); // Filter by status
        const type = searchParams.get('type'); // Filter by type: "user" or "deal"

        // Get all connections
        const allConnections = await getAllConnections();

        // Filter by status if provided
        let filteredConnections = allConnections;
        if (status) {
            if (status.toLowerCase() === 'email_sent') {
                // Filter for connections where email has been sent
                filteredConnections = allConnections.filter(conn => {
                    const emailSentAt = conn.email_sent_at || conn['email_sent_at'] || conn['Email Sent At'] || '';
                    return !!emailSentAt && emailSentAt.trim() !== '';
                });
            } else {
                filteredConnections = allConnections.filter(conn => {
                    const connStatus = conn.status || conn['status'] || conn['Status'];
                    return connStatus && connStatus.toLowerCase() === status.toLowerCase();
                });
            }
        }

        // Filter by type if provided
        if (type) {
            filteredConnections = filteredConnections.filter(conn => {
                if (type === 'user') {
                    const toUserId = conn.to_user_id || conn['to_user_id'] || conn['To User ID'];
                    return !!toUserId;
                } else if (type === 'deal') {
                    const dealId = conn.deal_id || conn['deal_id'] || conn['Deal ID'];
                    return !!dealId;
                }
                return true;
            });
        }

        // Get deals data for deal_name lookup
        const { getSheetData } = await import("@/app/lib/googleSheets");
        let dealsMap = new Map();
        const dealIds = [...new Set(filteredConnections
            .map(conn => conn.deal_id || conn['deal_id'] || conn['Deal ID'])
            .filter(Boolean)
        )];

        if (dealIds.length > 0) {
            try {
                // Fetch all deals once
                const allDeals = await getSheetData(SHEETS.DEALS);
                // Create a map of deal_id -> deal
                allDeals.forEach(deal => {
                    const dId = deal.deal_id || deal['deal_id'] || deal.id || deal['id'];
                    if (dId) {
                        dealsMap.set(String(dId).trim(), deal);
                    }
                });
            } catch (error) {
                console.error('Error fetching deals for deal_name lookup:', error);
            }
        }

        // Helper function to convert Google Sheets boolean values to actual booleans
        const toBoolean = (value) => {
            if (value === true || value === false) return value;
            if (typeof value === 'string') {
                const lower = value.toLowerCase().trim();
                return lower === 'true' || lower === '1' || lower === 'yes';
            }
            return false;
        };

        // Format connections for response
        const formattedConnections = filteredConnections.map(conn => {
            const dealId = conn.deal_id || conn['deal_id'] || conn['Deal ID'];
            const deal = dealId ? dealsMap.get(String(dealId).trim()) : null;
            const dealName = deal ? (deal.deal_name || deal['deal_name'] || '') : '';

            // Get raw values for boolean fields
            const rawAdminApproved = conn.admin_approved || conn['admin_approved'] || conn['Admin Approved'] || false;
            const rawClientApproved = conn.client_approved || conn['client_approved'] || conn['Client Approved'] || false;
            const rawAdminFinalApproved = conn.admin_final_approved || conn['admin_final_approved'] || conn['Admin Final Approved'] || false;
            const rawDraftLocked = conn.draft_locked || conn['draft_locked'] || conn['Draft Locked'] || false;

            return {
                connection_id: conn.connection_id || conn['connection_id'] || conn['Connection ID'],
                from_user_id: conn.from_user_id || conn['from_user_id'] || conn['From User ID'],
                to_user_id: conn.to_user_id || conn['to_user_id'] || conn['To User ID'],
                deal_id: dealId,
                deal_name: dealName, // Include deal_name in response
                from_user_name: conn.from_user_name || conn['from_user_name'] || conn['From User Name'],
                to_user_name: conn.to_user_name || conn['to_user_name'] || conn['To User Name'],
                from_user_email: conn.from_user_email || conn['from_user_email'] || conn['From User Email'],
                to_user_email: conn.to_user_email || conn['to_user_email'] || conn['To User Email'],
                from_user_linkedin: conn.from_user_linkedin || conn['from_user_linkedin'] || conn['From User LinkedIn'],
                to_user_linkedin: conn.to_user_linkedin || conn['to_user_linkedin'] || conn['To User LinkedIn'],
                connection_type: conn.connection_type || conn['connection_type'] || conn['Connection Type'],
                status: conn.status || conn['status'] || conn['Status'],
                requested_at: conn.requested_at || conn['requested_at'] || conn['Requested At'],
                // Properly convert boolean values from Google Sheets
                admin_approved: toBoolean(rawAdminApproved),
                draft_message: conn.draft_message || conn['draft_message'] || conn['Draft Message'] || '',
                draft_generated_at: conn.draft_generated_at || conn['draft_generated_at'] || conn['Draft Generated At'] || '',
                client_approved: toBoolean(rawClientApproved),
                client_approved_at: conn.client_approved_at || conn['client_approved_at'] || conn['Client Approved At'] || '',
                admin_final_approved: toBoolean(rawAdminFinalApproved),
                draft_locked: toBoolean(rawDraftLocked),
                client_goals: conn.client_goals || conn['client_goals'] || conn['Client Goals'] || '',
                related_signal_id: conn.related_signal_id || conn['related_signal_id'] || conn['Related Signal ID'] || '',
                // Email tracking fields
                email_status: conn.email_status || conn['email_status'] || conn['Email Status'] || '',
                email_sent_at: conn.email_sent_at || conn['email_sent_at'] || conn['Email Sent At'] || '',
                last_sent_message: conn.last_sent_message || conn['last_sent_message'] || conn['Last Sent Message'] || '',
            };
        });

        // Sort by requested_at (newest first)
        formattedConnections.sort((a, b) => {
            const dateA = new Date(a.requested_at || 0);
            const dateB = new Date(b.requested_at || 0);
            return dateB - dateA;
        });

        return NextResponse.json({
            success: true,
            connections: formattedConnections,
            count: formattedConnections.length,
        });
    } catch (error) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        console.error("Error fetching admin connections:", error);
        return NextResponse.json(
            { error: "Failed to fetch connections", details: error.message },
            { status: 500 }
        );
    }
}

