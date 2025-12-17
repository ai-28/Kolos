import { NextResponse } from "next/server";
import { findRowsByProfileId, SHEETS } from "@/app/lib/googleSheets";
import { requireAuth } from "@/app/lib/session";
import { normalizeRole } from "@/app/lib/roleUtils";

// GET - Fetch signals for authenticated user (or for a specific profile_id if admin)
export async function GET(request) {
    try {
        // Get client_id from session
        const session = await requireAuth();
        const userRole = session.role || '';
        const sessionClientId = session.clientId;

        // Check if user is admin
        const normalizedRole = normalizeRole(userRole);
        const isAdmin = normalizedRole === 'admin';

        // Get profile_id from query params if provided (for admin viewing other clients)
        const { searchParams } = new URL(request.url);
        const queryProfileId = searchParams.get('profile_id');

        // Determine which profile_id to use
        let profileId;
        if (isAdmin && queryProfileId) {
            // Admin can view any client's signals
            profileId = queryProfileId;
        } else {
            // Regular users can only view their own signals
            profileId = sessionClientId;
        }

        if (!profileId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Get signals for the specified profile
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

