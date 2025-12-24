import { NextResponse } from "next/server";
import { findUserByEmail, getSheetData, SHEETS } from "@/app/lib/googleSheets";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url)
        const email = searchParams.get('email')

        if (!email) {
            return NextResponse.json(
                { error: "Email is required" },
                { status: 400 }
            );
        }

        // Look up user in Users sheet
        const user = await findUserByEmail(email)

        if (!user) {
            console.error(`User not found in Users sheet: ${email}`)
            return NextResponse.json(
                { error: "user_not_found" },
                { status: 404 }
            );
        }

        // Get client_id from user record (check multiple possible field names including 'id')
        let clientId = user.client_id || user.clientId || user['client_id'] || user['Client ID'] || user['Client_ID'] || user.id || user.ID || user['id'] || user['ID']
        const role = user.role || user.Role || user['role'] || ''

        // Normalize role to check if admin
        const roleLower = role.toLowerCase().trim()
        const isAdmin = roleLower.includes('admin') || roleLower.includes('administrator')

        // For non-admin users: if client_id not found or might be invalid, try to find client in Profiles sheet by email
        // This ensures we use the correct ID from Profiles sheet
        if (!isAdmin && (!clientId || clientId === email)) {
            console.log(`Client ID not found or invalid for user: ${email}, searching Profiles sheet...`)
            try {
                const profiles = await getSheetData(SHEETS.PROFILES)
                const profile = profiles.find(
                    (p) => p.email && p.email.toLowerCase().trim() === email.toLowerCase().trim()
                )

                if (profile) {
                    // Use the ID from Profiles sheet as client_id
                    const profileId = profile.id || profile.ID || profile['id'] || profile['ID']
                    if (profileId) {
                        console.log(`Found profile for ${email}, using profile ID: ${profileId}`)
                        clientId = profileId
                    }
                } else {
                    console.log(`Profile not found in Profiles sheet for: ${email}`)
                }
            } catch (profileError) {
                console.error('Error searching Profiles sheet:', profileError)
                // Continue with original clientId if profile search fails
            }
        }

        // For admin users, client_id might be optional or set to a special value
        // For non-admin users, client_id is required
        if (!clientId && !isAdmin) {
            console.error(`No client_id found for user: ${email}`)
            return NextResponse.json(
                { error: "no_client_id" },
                { status: 400 }
            );
        }

        // For admin, use email or a special identifier as client_id if not provided
        const finalClientId = clientId || (isAdmin ? `admin_${email}` : null)

        if (!finalClientId) {
            console.error(`No client_id found for user: ${email}`)
            return NextResponse.json(
                { error: "no_client_id" },
                { status: 400 }
            );
        }

        // Create response
        const response = NextResponse.json({
            success: true,
            email,
            clientId: finalClientId,
            role,
        })

        // Set session cookies
        // Modern best practice: Shorter expiration (1 day) with Supabase handling refresh
        // Supabase automatically refreshes tokens, so we don't need 7-day cookies
        const cookieMaxAge = 60 * 60 * 24 // 1 day (Supabase handles longer sessions via refresh tokens)

        response.cookies.set('user_email', email, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: cookieMaxAge,
            path: '/',
        })

        response.cookies.set('client_id', finalClientId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: cookieMaxAge,
            path: '/',
        })

        response.cookies.set('user_role', role, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: cookieMaxAge,
            path: '/',
        })

        console.log(`✅ User authenticated: ${email} -> client_id: ${finalClientId}, role: ${role}`)
        return response
    } catch (error) {
        console.error('Error completing login:', error)
        return NextResponse.json(
            { error: "login_failed", details: error.message },
            { status: 500 }
        );
    }
}

