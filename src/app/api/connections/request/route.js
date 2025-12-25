import { NextResponse } from "next/server";
import { appendToSheet, findRowById, findConnectionBetweenUsers, SHEETS } from "@/app/lib/googleSheets";
import { requireAuth } from "@/app/lib/session";

/**
 * POST /api/connections/request
 * Create a connection request (user-to-user or deal connection)
 */
export async function POST(request) {
    try {
        const session = await requireAuth();
        const fromUserId = session.clientId;

        if (!fromUserId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const {
            to_user_id,
            deal_id,
            connection_type, // "linkedin" | "email" | "both"
            message,
        } = body;

        // Validate required fields
        if (!to_user_id && !deal_id) {
            return NextResponse.json(
                { error: "Either to_user_id or deal_id is required" },
                { status: 400 }
            );
        }

        if (!connection_type || !['linkedin', 'email', 'both'].includes(connection_type)) {
            return NextResponse.json(
                { error: "connection_type must be 'linkedin', 'email', or 'both'" },
                { status: 400 }
            );
        }

        // Get from user profile
        const fromUser = await findRowById(SHEETS.PROFILES, fromUserId);
        if (!fromUser) {
            return NextResponse.json(
                { error: "From user profile not found" },
                { status: 404 }
            );
        }

        let toUser = null;
        let deal = null;

        // If user-to-user connection
        if (to_user_id) {
            // Check if connection already exists
            const existingConnection = await findConnectionBetweenUsers(fromUserId, to_user_id);
            if (existingConnection) {
                return NextResponse.json(
                    { 
                        error: "Connection already exists",
                        connection_id: existingConnection.connection_id || existingConnection['connection_id'],
                    },
                    { status: 409 }
                );
            }

            toUser = await findRowById(SHEETS.PROFILES, to_user_id);
            if (!toUser) {
                return NextResponse.json(
                    { error: "To user profile not found" },
                    { status: 404 }
                );
            }
        }

        // If deal connection
        if (deal_id) {
            const { findRowsByProfileId } = await import("@/app/lib/googleSheets");
            const deals = await findRowsByProfileId(SHEETS.DEALS, fromUserId);
            deal = deals.find(d => {
                const dId = d.deal_id || d['deal_id'] || d.id || d['id'];
                return dId && String(dId).trim() === String(deal_id).trim();
            });

            if (!deal) {
                return NextResponse.json(
                    { error: "Deal not found" },
                    { status: 404 }
                );
            }
        }

        // Generate connection ID
        const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create connection row
        const connectionRow = [
            connectionId,
            fromUserId,
            to_user_id || '',
            deal_id || '',
            fromUser.name || fromUser['name'] || '',
            toUser ? (toUser.name || toUser['name'] || '') : (deal ? (deal.decision_maker_name || deal['decision_maker_name'] || '') : ''),
            fromUser.linkedin_url || fromUser['linkedin_url'] || '',
            toUser ? (toUser.linkedin_url || toUser['linkedin_url'] || '') : (deal ? (deal.decision_maker_linkedin_url || deal['decision_maker_linkedin_url'] || '') : ''),
            fromUser.email || fromUser['email'] || '',
            toUser ? (toUser.email || toUser['email'] || '') : (deal ? (deal.decision_maker_email || deal['decision_maker_email'] || '') : ''),
            connection_type,
            'pending',
            message || '',
            new Date().toISOString(),
            '', // accepted_at
            false, // linkedin_clicked
            false, // email_sent
            false, // user_marked_connected
        ];

        // Append to Connections sheet
        await appendToSheet(SHEETS.CONNECTIONS, connectionRow);

        return NextResponse.json({
            success: true,
            connection_id: connectionId,
            message: "Connection request created successfully",
        });
    } catch (error) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        console.error("Error creating connection request:", error);
        return NextResponse.json(
            { error: "Failed to create connection request", details: error.message },
            { status: 500 }
        );
    }
}

