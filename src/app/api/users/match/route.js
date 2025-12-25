import { NextResponse } from "next/server";
import { getSheetData, SHEETS } from "@/app/lib/googleSheets";
import { requireAuth } from "@/app/lib/session";
import { normalizeRole } from "@/app/lib/roleUtils";

/**
 * Calculate match score between two users
 */
function calculateMatchScore(userA, userB) {
    let score = 0;
    const reasons = [];

    // Industry match (30%)
    const industriesA = (userA.industries || '').toLowerCase().split(',').map(i => i.trim());
    const industriesB = (userB.industries || '').toLowerCase().split(',').map(i => i.trim());
    const industryOverlap = industriesA.some(ind => industriesB.includes(ind));
    if (industryOverlap) {
        score += 30;
        reasons.push("Same industry focus");
    }

    // Role complementarity (25%)
    const roleA = normalizeRole(userA.role || '');
    const roleB = normalizeRole(userB.role || '');
    
    const complementaryPairs = [
        ['Investor', 'Entrepreneur'],
        ['Investor', 'Asset Manager'],
        ['Facilitator', 'Investor'],
        ['Facilitator', 'Entrepreneur'],
        ['Facilitator', 'Asset Manager'],
    ];
    
    const isComplementary = complementaryPairs.some(
        ([r1, r2]) => (roleA === r1 && roleB === r2) || (roleA === r2 && roleB === r1)
    );
    
    if (isComplementary) {
        score += 25;
        reasons.push(`Complementary roles: ${roleA} ↔ ${roleB}`);
    } else if (roleA === roleB && roleA !== 'Investor') {
        // Same role can also be good (peer networking)
        score += 15;
        reasons.push(`Same role: ${roleA}`);
    }

    // Geographic match (20%)
    const regionsA = (userA.regions || '').toLowerCase().split(',').map(r => r.trim());
    const regionsB = (userB.regions || '').toLowerCase().split(',').map(r => r.trim());
    const regionOverlap = regionsA.some(reg => regionsB.includes(reg));
    if (regionOverlap) {
        score += 20;
        reasons.push("Same geographic focus");
    }

    // Deal size compatibility (15%)
    const dealSizeA = userA.deal_size || userA.project_size || '';
    const dealSizeB = userB.deal_size || userB.project_size || '';
    if (dealSizeA && dealSizeB) {
        // Simple check if both have deal sizes mentioned
        score += 10;
        reasons.push("Both have active deal sizes");
    }

    // Partner type match (10%)
    const partnerTypesA = (userA.partner_types || '').toLowerCase().split(',').map(p => p.trim());
    if (partnerTypesA.includes(roleB.toLowerCase())) {
        score += 10;
        reasons.push(`User B's role matches your partner preferences`);
    }

    return { score, reasons };
}

/**
 * GET /api/users/match
 * Get matched users for the authenticated user
 */
export async function GET(request) {
    try {
        const session = await requireAuth();
        const currentUserId = session.clientId;

        if (!currentUserId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // Get query parameters
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '10', 10);

        // Get all profiles
        const allProfiles = await getSheetData(SHEETS.PROFILES);

        // Find current user's profile
        const currentUser = allProfiles.find(profile => {
            const profileId = profile.id || profile.ID || profile['id'] || profile['ID'];
            return profileId && String(profileId).trim() === String(currentUserId).trim();
        });

        if (!currentUser) {
            return NextResponse.json(
                { error: "User profile not found" },
                { status: 404 }
            );
        }

        // // Get existing connections to exclude already connected users
        // const { findConnectionsByUserId } = await import("@/app/lib/googleSheets");
        // const existingConnections = await findConnectionsByUserId(currentUserId);
        // const connectedUserIds = new Set();
        
        // existingConnections.forEach(conn => {
        //     const fromId = conn.from_user_id || conn['from_user_id'] || conn['From User ID'];
        //     const toId = conn.to_user_id || conn['to_user_id'] || conn['To User ID'];
        //     if (fromId && String(fromId).trim() === String(currentUserId).trim()) {
        //         connectedUserIds.add(String(toId).trim());
        //     }
        //     if (toId && String(toId).trim() === String(currentUserId).trim()) {
        //         connectedUserIds.add(String(fromId).trim());
        //     }
        // });

        // Calculate matches for all other users
        const matches = allProfiles
            // .filter(profile => {
            //     const profileId = profile.id || profile.ID || profile['id'] || profile['ID'];
            //     // Exclude current user and already connected users
            //     return profileId && 
            //            String(profileId).trim() !== String(currentUserId).trim() &&
            //            !connectedUserIds.has(String(profileId).trim());
            // })
            .map(profile => {
                const matchResult = calculateMatchScore(currentUser, profile);
                return {
                    client_id: profile.id || profile.ID || profile['id'] || profile['ID'],
                    name: profile.name || profile['name'] || '',
                    email: profile.email || profile['email'] || '',
                    company: profile.company || profile['company'] || '',
                    role: profile.role || profile['role'] || '',
                    linkedin_url: profile.linkedin_url || profile['linkedin_url'] || '',
                    industries: profile.industries || profile['industries'] || '',
                    regions: profile.regions || profile['regions'] || '',
                    match_score: matchResult.score,
                    match_reasons: matchResult.reasons,
                };
            })
            .filter(match => match.match_score > 0) // Only return users with some match
            .sort((a, b) => b.match_score - a.match_score)
            .slice(0, limit);

        return NextResponse.json({
            success: true,
            matches,
            count: matches.length,
        });
    } catch (error) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        console.error("Error matching users:", error);
        return NextResponse.json(
            { error: "Failed to match users", details: error.message },
            { status: 500 }
        );
    }
}

