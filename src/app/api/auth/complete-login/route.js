import { NextResponse } from "next/server";
import { findUserByEmail } from "@/app/lib/googleSheets";

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
        const clientId = user.client_id || user.clientId || user['client_id'] || user['Client ID'] || user['Client_ID'] || user.id || user.ID || user['id'] || user['ID']
        const role = user.role || user.Role || user['role'] || ''
        
        // Normalize role to check if admin
        const roleLower = role.toLowerCase().trim()
        const isAdmin = roleLower.includes('admin') || roleLower.includes('administrator')

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
        response.cookies.set('user_email', email, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        })
        
        response.cookies.set('client_id', finalClientId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
            path: '/',
        })
        
        response.cookies.set('user_role', role, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
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

