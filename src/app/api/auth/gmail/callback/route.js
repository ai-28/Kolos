import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/session";
import { findRowById, updateProfile } from "@/app/lib/googleSheets";
import { encrypt } from "@/app/lib/encryption";

export async function GET(request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUrl = `${baseUrl}/client/dashboard`;

    if (error) {
      return NextResponse.redirect(
        `${redirectUrl}?gmail_error=${error}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${redirectUrl}?gmail_error=no_code`
      );
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${baseUrl}/api/auth/gmail/callback`,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token exchange error:', tokens);
      return NextResponse.redirect(
        `${redirectUrl}?gmail_error=${encodeURIComponent(tokens.error || 'Failed to get tokens')}`
      );
    }

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(
        `${redirectUrl}?gmail_error=missing_tokens`
      );
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = encrypt(tokens.refresh_token);

    // Update user profile with encrypted tokens
    const profileId = session.clientId;
    const profile = await findRowById('Profiles', profileId);

    if (!profile) {
      return NextResponse.redirect(
        `${redirectUrl}?gmail_error=profile_not_found`
      );
    }

    // Update profile with Gmail connection info
    await updateProfile(profileId, {
      gmail_access_token: JSON.stringify(encryptedAccessToken),
      gmail_refresh_token: JSON.stringify(encryptedRefreshToken),
      gmail_connected: 'true',
      gmail_connected_at: new Date().toISOString(),
    });

    return NextResponse.redirect(
      `${redirectUrl}?gmail_connected=true`
    );
  } catch (error) {
    console.error('Gmail OAuth error:', error);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return NextResponse.redirect(
      `${baseUrl}/client/dashboard?gmail_error=${encodeURIComponent(error.message || 'Unknown error')}`
    );
  }
}

