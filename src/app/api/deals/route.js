import { NextResponse } from "next/server";
import { appendToSheet, findRowsByProfileId, SHEETS } from "@/app/lib/googleSheets";
import { requireAuth } from "@/app/lib/session";

// GET - Fetch deals for authenticated user
export async function GET(request) {
    try {
        // Get client_id from session
        const session = await requireAuth();
        const profileId = session.clientId;

        if (!profileId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Get deals for the logged-in user
        const deals = await findRowsByProfileId(SHEETS.DEALS, profileId);

        return NextResponse.json({
            success: true,
            deals,
            count: deals.length,
        });
    } catch (error) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        console.error("Error fetching deals:", error);
        return NextResponse.json(
            { error: "Failed to fetch deals", details: error.message },
            { status: 500 }
        );
    }
}

// POST - Create a new deal
export async function POST(req) {
    try {
        // Get client_id from session
        const session = await requireAuth();
        const profileId = session.clientId;

        if (!profileId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const deal = await req.json();

        // Generate deal_id if not provided
        const dealId = deal.deal_id || `deal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const dealRow = [
            dealId, // deal_id (first column)
            profileId, // Use session client_id instead of deal.profile_id
            deal.deal_name || '',
            deal.owner || '',
            deal.target || '',
            deal.source || '',
            deal.stage || 'list',
            deal.target_deal_size || '',
            deal.next_step || '',
        ];

        await appendToSheet(SHEETS.DEALS, dealRow);

        return NextResponse.json({
            success: true,
            message: "Deal created successfully",
            deal_id: dealId,
        });
    } catch (error) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        console.error("Error creating deal:", error);
        return NextResponse.json(
            { error: "Failed to create deal", details: error.message },
            { status: 500 }
        );
    }
}

