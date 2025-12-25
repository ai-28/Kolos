import { NextResponse } from "next/server";
import { findRowsByProfileId, SHEETS, appendToSheet, findRowById } from "@/app/lib/googleSheets";
import { requireAuth } from "@/app/lib/session";

/**
 * POST /api/deals/[id]/connect
 * Request connection with decision maker from a deal
 */
export async function POST(request, { params }) {
    try {
        const session = await requireAuth();
        const userId = session.clientId;
        const { id } = await params;
        const dealId = id;

        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { connection_type, message } = body;

        if (!connection_type || !['linkedin', 'email', 'both'].includes(connection_type)) {
            return NextResponse.json(
                { error: "connection_type must be 'linkedin', 'email', or 'both'" },
                { status: 400 }
            );
        }

        // Get user's deals
        const deals = await findRowsByProfileId(SHEETS.DEALS, userId);

        // Debug logging
        console.log(`🔍 Looking for deal ${dealId} for user ${userId}`);
        console.log(`📊 Found ${deals.length} deals for this user`);

        // Log first deal's keys for debugging
        if (deals.length > 0) {
            console.log(`🔑 Sample deal keys:`, Object.keys(deals[0]));
            const sampleDealId = deals[0].deal_id || deals[0]['deal_id'] || deals[0].id || deals[0]['id'] ||
                deals[0]['Deal ID'] || deals[0]['Deal_ID'] || deals[0]['DealId'] ||
                deals[0]['deal ID'] || deals[0]['deal_ID'] || 'UNKNOWN';
            console.log(`📝 Sample deal ID field value:`, sampleDealId);
        }

        const deal = deals.find(d => {
            // Check multiple possible field names for deal_id
            const dId = d.deal_id || d['deal_id'] || d.id || d['id'] ||
                d['Deal ID'] || d['Deal_ID'] || d['DealId'] ||
                d['deal ID'] || d['deal_ID'];
            const matches = dId && String(dId).trim() === String(dealId).trim();
            if (matches) {
                console.log(`✅ Found matching deal: ${dId}`);
            }
            return matches;
        });

        if (!deal) {
            // Log available deal IDs for debugging
            const availableDealIds = deals.map(d =>
                d.deal_id || d['deal_id'] || d.id || d['id'] ||
                d['Deal ID'] || d['Deal_ID'] || d['DealId'] ||
                d['deal ID'] || d['deal_ID'] || 'NO_ID'
            ).filter(id => id !== 'NO_ID');

            console.error(`❌ Deal ${dealId} not found for user ${userId}`);
            console.error(`📋 Available deal IDs:`, availableDealIds);

            return NextResponse.json(
                {
                    error: "Deal not found",
                    debug: {
                        requestedDealId: dealId,
                        userId: userId,
                        userDealsCount: deals.length,
                        availableDealIds: availableDealIds.slice(0, 5) // First 5 for debugging
                    }
                },
                { status: 404 }
            );
        }

        // Check if decision maker info exists
        const decisionMakerLinkedIn = deal.decision_maker_linkedin_url || deal['decision_maker_linkedin_url'] || '';
        const decisionMakerEmail = deal.decision_maker_email || deal['decision_maker_email'] || '';

        if (!decisionMakerLinkedIn && !decisionMakerEmail) {
            return NextResponse.json(
                { error: "No contact information available for this deal's decision maker" },
                { status: 400 }
            );
        }

        // Get from user profile
        const fromUser = await findRowById(SHEETS.PROFILES, userId);
        if (!fromUser) {
            return NextResponse.json(
                { error: "From user profile not found" },
                { status: 404 }
            );
        }

        // Generate connection ID
        const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create connection row
        const connectionRow = [
            connectionId,
            userId,
            '', // to_user_id (empty for deal connections)
            dealId,
            fromUser.name || fromUser['name'] || '',
            deal.decision_maker_name || deal['decision_maker_name'] || '',
            fromUser.linkedin_url || fromUser['linkedin_url'] || '',
            deal.decision_maker_linkedin_url || deal['decision_maker_linkedin_url'] || '',
            fromUser.email || fromUser['email'] || '',
            deal.decision_maker_email || deal['decision_maker_email'] || '',
            connection_type,
            'pending',
            message || `Interested in connecting regarding: ${deal.deal_name || deal['deal_name'] || 'this opportunity'}`,
            new Date().toISOString(),
            '', // accepted_at
            false, // linkedin_clicked
            false, // email_sent
            false, // user_marked_connected
        ];

        // Append to Connections sheet
        await appendToSheet(SHEETS.CONNECTIONS, connectionRow);

        const connectionData = {
            success: true,
            connection_id: connectionId,
        };

        // Return connection info with decision maker details
        return NextResponse.json({
            success: true,
            connection_id: connectionData.connection_id,
            decision_maker: {
                name: deal.decision_maker_name || deal['decision_maker_name'] || '',
                role: deal.decision_maker_role || deal['decision_maker_role'] || '',
                linkedin_url: decisionMakerLinkedIn,
                email: decisionMakerEmail,
            },
            connection_type,
            message: "Connection request created successfully",
        });
    } catch (error) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        console.error("Error creating deal connection:", error);
        return NextResponse.json(
            { error: "Failed to create deal connection", details: error.message },
            { status: 500 }
        );
    }
}

