import { NextResponse } from "next/server";
import { findRowsByProfileId, getSheetData, SHEETS } from "@/app/lib/googleSheets";

// GET - Fetch signals, optionally filtered by profile_id
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const profileId = searchParams.get("profile_id");

        let signals;
        if (profileId) {
            // Get signals for a specific profile
            signals = await findRowsByProfileId(SHEETS.SIGNALS, profileId);
        } else {
            // Get all signals
            signals = await getSheetData(SHEETS.SIGNALS);
        }

        return NextResponse.json({
            success: true,
            signals,
            count: signals.length,
        });
    } catch (error) {
        console.error("Error fetching signals:", error);
        return NextResponse.json(
            { error: "Failed to fetch signals", details: error.message },
            { status: 500 }
        );
    }
}

