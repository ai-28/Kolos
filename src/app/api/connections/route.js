import { NextResponse } from "next/server";
import { findConnectionsByUserId, SHEETS } from "@/app/lib/googleSheets";
import { requireAuth } from "@/app/lib/session";

/**
 * GET /api/connections
 * Get all connections for the authenticated user
 */
export async function GET(request) {
    try {
        const session = await requireAuth();
        const userId = session.clientId;

        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Get query parameters
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status'); // Filter by status
        const type = searchParams.get('type'); // Filter by type: "user" or "deal"

        // Get all connections for this user
        const allConnections = await findConnectionsByUserId(userId);

        // Filter by status if provided
        let filteredConnections = allConnections;
        if (status) {
            filteredConnections = allConnections.filter(conn => {
                const connStatus = conn.status || conn['status'] || conn['Status'];
                return connStatus && connStatus.toLowerCase() === status.toLowerCase();
            });
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

        // Helper function to convert Google Sheets boolean values to actual booleans
        const toBoolean = (value) => {
            if (value === true || value === false) return value;
            if (typeof value === 'string') {
                const lower = value.toLowerCase().trim();
                return lower === 'true' || lower === '1' || lower === 'yes';
            }
            return false;
        };

        // Get deals data for deal_name lookup
        const { findRowsByProfileId } = await import("@/app/lib/googleSheets");
        let dealsMap = new Map();
        const dealIds = [...new Set(filteredConnections
            .map(conn => conn.deal_id || conn['deal_id'] || conn['Deal ID'])
            .filter(Boolean)
        )];

        if (dealIds.length > 0) {
            try {
                // Fetch all deals for this user once
                const deals = await findRowsByProfileId(SHEETS.DEALS, userId);
                // Create a map of deal_id -> deal
                deals.forEach(deal => {
                    const dId = deal.deal_id || deal['deal_id'] || deal.id || deal['id'];
                    if (dId) {
                        dealsMap.set(String(dId).trim(), deal);
                    }
                });
            } catch (error) {
                console.error('Error fetching deals for deal_name lookup:', error);
            }
        }

        // Format connections for response
        const formattedConnections = filteredConnections.map(conn => {
            const isFromUser = (conn.from_user_id || conn['from_user_id'] || conn['From User ID']) === userId;
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
                connection_type: conn.connection_type || conn['connection_type'] || conn['Connection Type'],
                status: conn.status || conn['status'] || conn['Status'],
                requested_at: conn.requested_at || conn['requested_at'] || conn['Requested At'],
                // New draft workflow fields - properly convert boolean values
                admin_approved: toBoolean(rawAdminApproved),
                draft_message: conn.draft_message || conn['draft_message'] || conn['Draft Message'] || '',
                draft_generated_at: conn.draft_generated_at || conn['draft_generated_at'] || conn['Draft Generated At'] || '',
                client_approved: toBoolean(rawClientApproved),
                client_approved_at: conn.client_approved_at || conn['client_approved_at'] || conn['Client Approved At'] || '',
                admin_final_approved: toBoolean(rawAdminFinalApproved),
                draft_locked: toBoolean(rawDraftLocked),
                client_goals: conn.client_goals || conn['client_goals'] || conn['Client Goals'] || '',
                related_signal_id: conn.related_signal_id || conn['related_signal_id'] || conn['Related Signal ID'] || '',
                // Other user's info
                other_user_name: isFromUser
                    ? (conn.to_user_name || conn['to_user_name'] || conn['To User Name'])
                    : (conn.from_user_name || conn['from_user_name'] || conn['From User Name']),
                other_user_linkedin: isFromUser
                    ? (conn.to_user_linkedin || conn['to_user_linkedin'] || conn['To User LinkedIn'])
                    : (conn.from_user_linkedin || conn['from_user_linkedin'] || conn['From User LinkedIn']),
                other_user_email: isFromUser
                    ? (conn.to_user_email || conn['to_user_email'] || conn['To User Email'])
                    : (conn.from_user_email || conn['from_user_email'] || conn['From User Email']),
                is_from_user: isFromUser,
            };
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
        console.error("Error fetching connections:", error);
        return NextResponse.json(
            { error: "Failed to fetch connections", details: error.message },
            { status: 500 }
        );
    }
}

