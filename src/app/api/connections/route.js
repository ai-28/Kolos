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

        // Format connections for response
        const formattedConnections = filteredConnections.map(conn => {
            const isFromUser = (conn.from_user_id || conn['from_user_id'] || conn['From User ID']) === userId;
            
            return {
                connection_id: conn.connection_id || conn['connection_id'] || conn['Connection ID'],
                from_user_id: conn.from_user_id || conn['from_user_id'] || conn['From User ID'],
                to_user_id: conn.to_user_id || conn['to_user_id'] || conn['To User ID'],
                deal_id: conn.deal_id || conn['deal_id'] || conn['Deal ID'],
                connection_type: conn.connection_type || conn['connection_type'] || conn['Connection Type'],
                status: conn.status || conn['status'] || conn['Status'],
                message: conn.message || conn['message'] || conn['Message'],
                requested_at: conn.requested_at || conn['requested_at'] || conn['Requested At'],
                accepted_at: conn.accepted_at || conn['accepted_at'] || conn['Accepted At'],
                linkedin_clicked: conn.linkedin_clicked || conn['linkedin_clicked'] || conn['LinkedIn Clicked'],
                email_sent: conn.email_sent || conn['email_sent'] || conn['Email Sent'],
                user_marked_connected: conn.user_marked_connected || conn['user_marked_connected'] || conn['User Marked Connected'],
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

