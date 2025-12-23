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

        // Get the base URL for redirect - must match EXACTLY what's in Supabase settings
        // signInWithOtp works, so we need to match its exact redirectTo format
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ai.kolos.network';
        // IMPORTANT: This must match exactly what signInWithOtp uses:
        // In EmailModal: `${window.location.origin}/auth/callback`
        // So we use the same format
        const redirectTo = `${baseUrl}/auth/callback`;

        console.log('Using redirectTo (must match Supabase settings):', redirectTo);

        console.log('Generating magic link:', {
            email,
            redirectTo,
            baseUrl,
        });

        // Generate magic link without sending email
        // Try to match the exact behavior of signInWithOtp which works
        // The key is using the same redirectTo and ensuring the link format matches
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: email,
            options: {
                redirectTo: redirectTo,
                // Note: admin.generateLink should create the same type of link as signInWithOtp
                // The expiration and format should be identical
            }
        });

        // If that fails, try alternative approach - create user if doesn't exist first
        if (error && error.message?.includes('User not found')) {
            console.log('User not found, this is expected for new users');
            // The generateLink should still work even if user doesn't exist yet
            // But let's continue with the error handling
        }

        if (error) {
            console.error('Error generating magic link:', error);
            return NextResponse.json(
                {
                    error: error.message || "Failed to generate magic link",
                    details: error
                },
                { status: 500 }
            );
        }

        if (!data || !data.properties || !data.properties.action_link) {
            console.error('Invalid response from Supabase:', data);
            return NextResponse.json(
                {
                    error: "Invalid response from Supabase",
                    data: data
                },
                { status: 500 }
            );
        }

        const magicLink = data.properties.action_link;

        console.log('Magic link generated successfully:', {
            email,
            linkLength: magicLink.length,
            linkPreview: magicLink.substring(0, 100) + '...',
        });

        // Return the magic link URL
        return NextResponse.json({
            success: true,
            magicLink: magicLink, // This is the actual magic link URL
        });

    } catch (error) {
        console.error('Error in generate-magic-link API:', error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

