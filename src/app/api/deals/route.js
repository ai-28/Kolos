import { NextResponse } from "next/server";
import { appendToSheet, getSheetData, findRowsByProfileId, SHEETS } from "@/app/lib/googleSheets";

// GET - Fetch all deals or filter by profile_id
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const profileId = searchParams.get("profile_id");

        let deals;
        if (profileId) {
            // Get deals for a specific profile
            deals = await findRowsByProfileId(SHEETS.DEALS, profileId);
        } else {
            // Get all deals
            deals = await getSheetData(SHEETS.DEALS);
        }

        return NextResponse.json({
            success: true,
            deals,
            count: deals.length,
        });
    } catch (error) {
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
        const deal = await req.json();

        // Validate required fields
        if (!deal.profile_id) {
            return NextResponse.json(
                { error: "profile_id is required" },
                { status: 400 }
            );
        }

        // Generate deal_id if not provided
        const dealId = deal.deal_id || `deal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const dealRow = [
            dealId, // deal_id (first column)
            deal.profile_id || '',
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
        console.error("Error creating deal:", error);
        return NextResponse.json(
            { error: "Failed to create deal", details: error.message },
            { status: 500 }
        );
    }
}

