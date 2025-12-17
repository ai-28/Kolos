import { NextResponse } from "next/server";
import { findRowsByProfileId, SHEETS } from "@/app/lib/googleSheets";
import { requireAuth } from "@/app/lib/session";

// GET - Fetch signals for authenticated user
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

        // Get signals for the logged-in user
        const signals = await findRowsByProfileId(SHEETS.SIGNALS, profileId);

        return NextResponse.json({
            success: true,
            signals,
            count: signals.length,
        });
    } catch (error) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        console.error("Error fetching signals:", error);
        return NextResponse.json(
            { error: "Failed to fetch signals", details: error.message },
            { status: 500 }
        );
    }
}

