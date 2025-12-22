import { NextResponse } from "next/server";
import { appendToSheet, findRowsByProfileId, SHEETS } from "@/app/lib/googleSheets";
import { requireAuth } from "@/app/lib/session";
import { normalizeRole } from "@/app/lib/roleUtils";
import { enrichDealWithApollo } from "@/app/lib/apollo";

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

        // Enrich deal with Apollo (await to get enriched data before saving)
        let enrichedDeal = deal;
        if (process.env.APOLLO_API_KEY && (deal.deal_name || deal.source || deal.next_step)) {
            try {
                enrichedDeal = await enrichDealWithApollo({
                    deal_name: deal.deal_name || '',
                    source: deal.source || '',
                    next_step: deal.next_step || '',
                    decision_maker_name: deal.decision_maker_name || '',
                    decision_maker_role: deal.decision_maker_role || '',
                    decision_maker_linkedin_url: deal.decision_maker_linkedin_url || '',
                });

                if (enrichedDeal.apollo_enriched) {
                    console.log(`✅ Apollo enrichment completed for deal ${dealId}:`, {
                        decision_maker_name: enrichedDeal.decision_maker_name,
                        decision_maker_role: enrichedDeal.decision_maker_role,
                        decision_maker_linkedin_url: enrichedDeal.decision_maker_linkedin_url,
                        decision_maker_email: enrichedDeal.decision_maker_email,
                    });
                } else if (enrichedDeal.apollo_error) {
                    console.log(`⚠️ Apollo enrichment failed for deal ${dealId}:`, enrichedDeal.apollo_error);
                }
            } catch (error) {
                console.error(`❌ Apollo enrichment error for deal ${dealId}:`, error);
                // Continue with original deal data if enrichment fails
            }
        }

        // Create deal row with enriched data
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
            // Apollo enriched fields
            enrichedDeal.decision_maker_name || '',
            enrichedDeal.decision_maker_role || '',
            enrichedDeal.decision_maker_linkedin_url || '',
            enrichedDeal.decision_maker_email || '',
            enrichedDeal.decision_maker_phone || '',
        ];

        await appendToSheet(SHEETS.DEALS, dealRow);

        return NextResponse.json({
            success: true,
            message: "Deal created successfully",
            deal_id: dealId,
            apollo_enrichment: enrichedDeal.apollo_enriched ? "completed" : (process.env.APOLLO_API_KEY ? "failed" : "not_configured"),
            decision_maker: enrichedDeal.apollo_enriched ? {
                name: enrichedDeal.decision_maker_name,
                role: enrichedDeal.decision_maker_role,
                linkedin_url: enrichedDeal.decision_maker_linkedin_url,
                email: enrichedDeal.decision_maker_email,
            } : null,
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

