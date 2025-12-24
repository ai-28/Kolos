import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function GET() {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json(
                { error: "Not authenticated" },
                { status: 401 }
            );
        }

        // Validate Supabase session is still valid
        // This ensures users are logged out when Supabase session expires
        if (supabaseUrl && supabaseAnonKey) {
            const cookieStore = cookies()
            const allCookies = Array.from(cookieStore.getAll())
            const hasSupabaseCookies = allCookies.some(cookie =>
                cookie.name.startsWith('sb-') ||
                cookie.name.includes('supabase') ||
                (cookie.name.includes('auth') && cookie.name.includes('token'))
            )

            const supabase = createClient(supabaseUrl, supabaseAnonKey, {
                cookies: {
                    get(name) {
                        return cookieStore.get(name)?.value
                    },
                    set(name, value, options) {
                        cookieStore.set({ name, value, ...options })
                    },
                    remove(name, options) {
                        cookieStore.set({ name, value: '', ...options })
                    },
                },
            })

            const { data: { user }, error } = await supabase.auth.getUser()

            if (error || !user) {
                // Check if this is a fresh login (custom cookies exist but Supabase cookies not set yet)
                const hasCustomCookies = cookieStore.get('user_email')?.value && cookieStore.get('client_id')?.value

                if (hasCustomCookies && !hasSupabaseCookies) {
                    // Fresh login - Supabase cookies not set yet, allow through
                    console.log('⚠️ Fresh login detected in session API - Supabase cookies not set yet, allowing through')
                    // Return session data even without Supabase validation for fresh logins
                    return NextResponse.json({
                        email: session.email,
                        clientId: session.clientId,
                        role: session.role,
                    });
                }

                // Supabase session expired or invalid, clear cookies and return 401
                console.log('⚠️ Supabase session expired or invalid, clearing cookies')
                const response = NextResponse.json(
                    { error: "Session expired" },
                    { status: 401 }
                )
                response.cookies.delete('user_email')
                response.cookies.delete('client_id')
                response.cookies.delete('user_role')
                return response
            }
        }

        return NextResponse.json({
            email: session.email,
            clientId: session.clientId,
            role: session.role,
        });
    } catch (error) {
        console.error("Error getting session:", error);
        return NextResponse.json(
            { error: "Failed to get session", details: error.message },
            { status: 500 }
        );
    }
}

