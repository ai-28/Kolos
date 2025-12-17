import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function POST() {
    try {
        if (supabaseUrl && supabaseAnonKey) {
            const supabase = createClient(supabaseUrl, supabaseAnonKey, {
                cookies: {
                    get(name) {
                        return cookies().get(name)?.value
                    },
                    set(name, value, options) {
                        cookies().set({ name, value, ...options })
                    },
                    remove(name, options) {
                        cookies().set({ name, value: '', ...options })
                    },
                },
            })

            await supabase.auth.signOut()
        }

        const response = NextResponse.json({ success: true })
        
        // Clear all session cookies
        response.cookies.delete('user_email')
        response.cookies.delete('client_id')
        response.cookies.delete('user_role')

        return response
    } catch (error) {
        console.error("Error logging out:", error);
        return NextResponse.json(
            { error: "Failed to logout", details: error.message },
            { status: 500 }
        );
    }
}

