import { NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
    try {
        const { email } = await request.json();

        if (!email) {
            return NextResponse.json(
                { error: "Email is required" },
                { status: 400 }
            );
        }

        // Use Supabase Admin API (service role key) - must be server-side only
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error('Missing Supabase configuration:', {
                hasUrl: !!supabaseUrl,
                hasServiceKey: !!supabaseServiceKey,
            });
            return NextResponse.json(
                { error: "Supabase configuration missing. Please set SUPABASE_SERVICE_ROLE_KEY in .env.local" },
                { status: 500 }
            );
        }

        // Create admin client with service role key
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // Get the base URL for redirect
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_VERCEL_URL
            ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
            : 'https://ai.kolos.network';

        // Generate magic link without sending email
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: email,
            options: {
                redirectTo: `${baseUrl}/auth/callback`,
            }
        });

        if (error) {
            console.error('Error generating magic link:', error);
            return NextResponse.json(
                { error: error.message || "Failed to generate magic link" },
                { status: 500 }
            );
        }

        if (!data || !data.properties || !data.properties.action_link) {
            console.error('Invalid response from Supabase:', data);
            return NextResponse.json(
                { error: "Invalid response from Supabase" },
                { status: 500 }
            );
        }

        // Return the magic link URL
        return NextResponse.json({
            success: true,
            magicLink: data.properties.action_link, // This is the actual magic link URL
        });

    } catch (error) {
        console.error('Error in generate-magic-link API:', error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

