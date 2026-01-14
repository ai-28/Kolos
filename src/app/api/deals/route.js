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

        console.log(`📝 Creating deal ${dealId} with data:`, {
            deal_name: deal.deal_name,
            source: deal.source,
            next_step: deal.next_step,
            profileId: profileId,
        });

        // Enrich deal with Apollo (await to get enriched data before saving)
        // Apollo will extract company name, decision maker name and role from signal data, then search Apollo for email/LinkedIn
        let enrichedDeal = deal;
        if (process.env.APOLLO_API_KEY && (deal.deal_name || deal.source || deal.next_step || deal.company_name || deal.decision_maker_name)) {
            console.log(`🔍 Starting Apollo enrichment for deal ${dealId}...`);
            console.log(`📝 Deal data for extraction:`, {
                deal_name: deal.deal_name?.substring(0, 100),
                headline_source: deal.headline_source?.substring(0, 100),
                source: deal.source?.substring(0, 100),
                next_step: deal.next_step?.substring(0, 100),
                company_name: deal.company_name,
                decision_maker_name: deal.decision_maker_name,
                decision_maker_role: deal.decision_maker_role,
            });
            try {
                enrichedDeal = await enrichDealWithApollo({
                    deal_name: deal.deal_name || '',
                    source: deal.source || '',
                    next_step: deal.next_step || '',
                    headline_source: deal.headline_source || '',  // Signal headline - important for extraction
                    company_name: deal.company_name || '',
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
                        decision_maker_phone: enrichedDeal.decision_maker_phone,
                    });
                } else if (enrichedDeal.apollo_error) {
                    console.log(`⚠️ Apollo enrichment failed for deal ${dealId}:`, enrichedDeal.apollo_error);
                    console.log(`📝 Continuing with deal creation without enrichment...`);
                }
            } catch (error) {
                console.error(`❌ Apollo enrichment error for deal ${dealId}:`, error);
                console.error(`📝 Error details:`, {
                    message: error.message,
                    stack: error.stack,
                });
                // Continue with original deal data if enrichment fails
                enrichedDeal = deal;
            }
        } else {
            if (!process.env.APOLLO_API_KEY) {
                console.log(`ℹ️ APOLLO_API_KEY not configured, skipping enrichment for deal ${dealId}`);
            } else {
                console.log(`ℹ️ Insufficient data for Apollo enrichment (need deal_name, source, or next_step)`);
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
            deal.stage || 'selected',
            deal.target_deal_size || '',
            deal.next_step || '',
            // Apollo enriched fields (primary decision maker for backward compatibility)
            enrichedDeal.decision_maker_name || '',
            enrichedDeal.decision_maker_role || '',
            enrichedDeal.decision_maker_linkedin_url || '',
            enrichedDeal.decision_maker_email || '',
            enrichedDeal.decision_maker_phone || '',
            // All decision makers (JSON array with all people found)
            enrichedDeal.all_decision_makers || '[]',
        ];

        console.log(`💾 Saving deal ${dealId} to Google Sheets with ${dealRow.length} columns...`);
        console.log(`📊 Deal row data:`, dealRow);

        try {
            await appendToSheet(SHEETS.DEALS, dealRow);
            console.log(`✅ Deal ${dealId} successfully saved to Google Sheets`);
        } catch (sheetError) {
            console.error(`❌ Failed to save deal ${dealId} to Google Sheets:`, sheetError);
            console.error(`📝 Sheet error details:`, {
                message: sheetError.message,
                code: sheetError.code,
                response: sheetError.response?.data,
            });
            throw sheetError; // Re-throw to be caught by outer try-catch
        }

        return NextResponse.json({
            success: true,
            message: "Deal created successfully",
            deal_id: dealId,
            profile_id: profileId,
            apollo_enrichment: enrichedDeal.apollo_enriched ? "completed" : (process.env.APOLLO_API_KEY ? "failed" : "not_configured"),
            apollo_error: enrichedDeal.apollo_error || null,
            apollo_debug: enrichedDeal.apollo_debug || null, // Add debug info for frontend
            decision_maker: enrichedDeal.apollo_enriched ? {
                name: enrichedDeal.decision_maker_name,
                role: enrichedDeal.decision_maker_role,
                linkedin_url: enrichedDeal.decision_maker_linkedin_url,
                email: enrichedDeal.decision_maker_email,
                phone: enrichedDeal.decision_maker_phone,
            } : null,
            all_decision_makers: enrichedDeal.apollo_enriched && enrichedDeal.all_decision_makers
                ? JSON.parse(enrichedDeal.all_decision_makers)
                : [],
            deal_data: {
                deal_name: deal.deal_name,
                source: deal.source,
                next_step: deal.next_step,
            }
        });
    } catch (error) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json(
                { error: "Unauthorized", details: "Please make sure you are logged in" },
                { status: 401 }
            );
        }
        console.error("Error creating deal:", error);

        // Provide more detailed error information
        let errorDetails = error.message;
        if (error.message.includes('GOOGLE_SHEET_ID')) {
            errorDetails = "Google Sheets configuration error. GOOGLE_SHEET_ID not set.";
        } else if (error.message.includes('append') || error.message.includes('spreadsheet')) {
            errorDetails = `Google Sheets error: ${error.message}. Please check:\n1. Sheet 'Deals' exists\n2. Google Sheets API permissions\n3. Column headers are correct`;
        }

        return NextResponse.json(
            {
                error: "Failed to create deal",
                details: errorDetails,
                error_type: error.name || "Error",
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            },
            { status: 500 }
        );
    }
}

