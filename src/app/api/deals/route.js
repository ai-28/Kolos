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

        const dealRow = [
            deal.profile_id || '',
            deal.company_name || deal.target_name || '',
            deal.source_signal_id || '',
            deal.contact_person || '',
            deal.stage || 'New',
            deal.owner || '',
            deal.next_step || '',
            deal.next_step_date || '',
            deal.estimated_value || '',
        ];

        await appendToSheet(SHEETS.DEALS, dealRow);

        return NextResponse.json({
            success: true,
            message: "Deal created successfully",
        });
    } catch (error) {
        console.error("Error creating deal:", error);
        return NextResponse.json(
            { error: "Failed to create deal", details: error.message },
            { status: 500 }
        );
    }
}

