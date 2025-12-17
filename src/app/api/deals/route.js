import { NextResponse } from "next/server";
import { appendToSheet, findRowsByProfileId, SHEETS } from "@/app/lib/googleSheets";
import { requireAuth } from "@/app/lib/session";
import { normalizeRole } from "@/app/lib/roleUtils";

// GET - Fetch deals for authenticated user (or for a specific profile_id if admin)
export async function GET(request) {
    try {
        // Get client_id from session
        const session = await requireAuth();
        const userRole = session.role || '';
        const sessionClientId = session.clientId;

        // Check if user is admin
        const normalizedRole = normalizeRole(userRole);
        const isAdmin = normalizedRole === 'Admin';

        // Get profile_id from query params if provided (for admin viewing other clients)
        const { searchParams } = new URL(request.url);
        const queryProfileId = searchParams.get('profile_id');

        // Determine which profile_id to use
        let profileId;
        if (isAdmin && queryProfileId) {
            // Admin can view any client's deals
            profileId = queryProfileId;
        } else {
            // Regular users can only view their own deals
            profileId = sessionClientId;
        }

        if (!profileId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Get deals for the specified profile
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
        const userRole = session.role || '';
        const sessionClientId = session.clientId;

        // Check if user is admin
        const normalizedRole = normalizeRole(userRole);
        const isAdmin = normalizedRole === 'Admin';

        const deal = await req.json();

        // Determine which profile_id to use
        let profileId;
        if (isAdmin && deal.profile_id) {
            // Admin can create deals for any client
            profileId = deal.profile_id;
        } else {
            // Regular users can only create deals for themselves
            profileId = sessionClientId;
        }

        if (!profileId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Generate deal_id if not provided
        const dealId = deal.deal_id || `deal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const dealRow = [
            dealId, // deal_id (first column)
            profileId, // Use determined profile_id
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

