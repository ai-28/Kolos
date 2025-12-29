import { NextResponse } from "next/server";
import { findRowById, findConnectionBetweenUsers, SHEETS } from "@/app/lib/googleSheets";
import { appendConnectionToSheet } from "@/app/lib/appendConnectionToSheet";
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
        } = body;

        // Validate required fields
        if (!to_user_id && !deal_id) {
            return NextResponse.json(
                { error: "Either to_user_id or deal_id is required" },
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

        // Validate connection ID was generated
        if (!connectionId || connectionId.trim() === '') {
            throw new Error('Failed to generate connection ID');
        }

        // Auto-detect connection_type based on available contact info
        const hasLinkedIn = toUser
            ? (toUser.linkedin_url || toUser['linkedin_url'])
            : (deal ? (deal.decision_maker_linkedin_url || deal['decision_maker_linkedin_url']) : false);
        const hasEmail = toUser
            ? (toUser.email || toUser['email'])
            : (deal ? (deal.decision_maker_email || deal['decision_maker_email']) : false);

        let autoConnectionType = '';
        if (hasLinkedIn && hasEmail) {
            autoConnectionType = 'both';
        } else if (hasLinkedIn) {
            autoConnectionType = 'linkedin';
        } else if (hasEmail) {
            autoConnectionType = 'email';
        }

        // Get client goals for AI context
        const clientGoals = fromUser.goals || fromUser['goals'] || '';

        // Prepare connection data object (will be mapped to correct columns)
        const connectionData = {
            connection_id: connectionId,
            from_user_id: fromUserId || '',
            to_user_id: to_user_id || '',
            deal_id: deal_id || '',
            from_user_name: fromUser.name || fromUser['name'] || '',
            to_user_name: toUser ? (toUser.name || toUser['name'] || '') : (deal ? (deal.decision_maker_name || deal['decision_maker_name'] || '') : ''),
            from_user_linkedin: fromUser.linkedin_url || fromUser['linkedin_url'] || '',
            to_user_linkedin: toUser ? (toUser.linkedin_url || toUser['linkedin_url'] || '') : (deal ? (deal.decision_maker_linkedin_url || deal['decision_maker_linkedin_url'] || '') : ''),
            from_user_email: fromUser.email || fromUser['email'] || '',
            to_user_email: toUser ? (toUser.email || toUser['email'] || '') : (deal ? (deal.decision_maker_email || deal['decision_maker_email'] || '') : ''),
            connection_type: autoConnectionType,
            status: 'pending',
            requested_at: new Date().toISOString(),
            admin_approved: false,
            draft_message: '',
            draft_generated_at: '',
            client_approved: false,
            client_approved_at: '',
            admin_final_approved: false,
            draft_locked: false,
            client_goals: clientGoals || '',
            related_signal_id: '',
        };

        // Log for debugging
        console.log('📝 Creating connection:', {
            connectionId,
            fromUserId,
            deal_id: deal_id || null,
            to_user_id: to_user_id || null
        });

        // Append to Connections sheet with proper column mapping
        await appendConnectionToSheet(connectionData);

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

