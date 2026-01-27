import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/session";
import { findConnectionById, updateConnection, findRowById } from "@/app/lib/googleSheets";
import { decrypt } from "@/app/lib/encryption";
import { google } from 'googleapis';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function refreshAccessToken(refreshToken) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Failed to refresh token');
  }

  return data.access_token;
}

export async function POST(request, { params }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const connectionId = String(id || '').trim();

    const { to_email, subject, draft_message, deal_id } = await request.json();

    if (!to_email || !draft_message) {
      return NextResponse.json(
        { error: "to_email and draft_message are required" },
        { status: 400 }
      );
    }

    // Get connection
    const connection = await findConnectionById(connectionId);
    if (!connection) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    // Verify ownership
    const fromUserId = connection.from_user_id || connection['from_user_id'];
    if (String(fromUserId).trim() !== String(session.clientId).trim()) {
      return NextResponse.json(
        { error: "Forbidden: You can only send emails for your own connections" },
        { status: 403 }
      );
    }

    // Verify draft is approved and locked
    const clientApproved = connection.client_approved || connection['client_approved'];
    const draftLocked = connection.draft_locked || connection['draft_locked'];

    if (!clientApproved || !draftLocked) {
      return NextResponse.json(
        { error: "Draft must be approved and locked before sending" },
        { status: 400 }
      );
    }

    // Get user profile with Gmail tokens
    const profile = await findRowById('Profiles', session.clientId);
    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    const gmailConnected = profile.gmail_connected || profile['gmail_connected'];

    // Helper function to check if value is truthy (handles true, 'true', 'TRUE', '1', etc.)
    const isTruthy = (value) => {
      if (value === true || value === 1) return true;
      if (typeof value === 'string') {
        const lower = value.toLowerCase().trim();
        return lower === 'true' || lower === '1' || lower === 'yes';
      }
      return false;
    };

    if (!gmailConnected || !isTruthy(gmailConnected)) {
      console.error('Gmail connection check failed:', {
        gmailConnected,
        type: typeof gmailConnected,
        profileId: session.clientId
      });
      return NextResponse.json(
        { error: "Gmail not connected. Please connect your Gmail account first." },
        { status: 400 }
      );
    }

    // Decrypt tokens
    const encryptedAccessToken = profile.gmail_access_token || profile['gmail_access_token'];
    const encryptedRefreshToken = profile.gmail_refresh_token || profile['gmail_refresh_token'];

    if (!encryptedAccessToken || !encryptedRefreshToken) {
      return NextResponse.json(
        { error: "Gmail tokens not found" },
        { status: 400 }
      );
    }

    let accessToken;
    let refreshToken;

    try {
      // Handle JSON stringified encrypted tokens
      const accessTokenData = typeof encryptedAccessToken === 'string'
        ? (encryptedAccessToken.startsWith('{') ? JSON.parse(encryptedAccessToken) : encryptedAccessToken)
        : encryptedAccessToken;
      const refreshTokenData = typeof encryptedRefreshToken === 'string'
        ? (encryptedRefreshToken.startsWith('{') ? JSON.parse(encryptedRefreshToken) : encryptedRefreshToken)
        : encryptedRefreshToken;

      accessToken = decrypt(accessTokenData);
      refreshToken = decrypt(refreshTokenData);
      console.log('✅ Tokens decrypted successfully');
    } catch (decryptError) {
      console.error('❌ Token decryption error:', {
        error: decryptError.message,
        accessTokenType: typeof encryptedAccessToken,
        refreshTokenType: typeof encryptedRefreshToken,
        accessTokenPreview: typeof encryptedAccessToken === 'string' ? encryptedAccessToken.substring(0, 50) : 'not string'
      });
      return NextResponse.json(
        { error: "Failed to decrypt Gmail tokens. Please reconnect your Gmail account." },
        { status: 500 }
      );
    }

    // Create Gmail API client
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${baseUrl}/api/auth/gmail/callback`
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Try to refresh token if needed
    let tokenRefreshed = false;
    try {
      const tokenInfo = await oauth2Client.getAccessToken();
      if (!tokenInfo.token) {
        throw new Error('Token is invalid');
      }
      console.log('✅ Access token is valid');
    } catch (error) {
      // Token expired, refresh it
      console.log('⚠️ Access token expired or invalid, refreshing...', error.message);
      try {
        accessToken = await refreshAccessToken(refreshToken);
        oauth2Client.setCredentials({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        tokenRefreshed = true;
        console.log('✅ Access token refreshed successfully');
      } catch (refreshError) {
        console.error('❌ Token refresh error:', {
          error: refreshError.message,
          response: refreshError.response?.data
        });
        return NextResponse.json(
          { error: "Gmail token expired. Please reconnect your Gmail account.", details: refreshError.message },
          { status: 401 }
        );
      }
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Get user's email address - prefer gmail_account_email (the actual connected Gmail account)
    // Fallback to profile.email if gmail_account_email is not available
    const fromEmail = profile.gmail_account_email || profile['gmail_account_email'] || profile.email || profile['email'];

    if (!fromEmail) {
      console.error('❌ No email found in user profile');
      return NextResponse.json(
        { error: "User email not found in profile" },
        { status: 400 }
      );
    }

    console.log('✅ Using email for sending:', fromEmail);

    // Create email message
    const emailContent = [
      `To: ${to_email}`,
      `From: ${fromEmail}`,
      `Subject: ${subject || 'Connection Request'}`,
      `Content-Type: text/plain; charset=utf-8`,
      '',
      draft_message,
    ].join('\n');

    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send email
    try {
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });
    } catch (sendError) {
      console.error('Gmail send error:', sendError);
      return NextResponse.json(
        { error: "Failed to send email via Gmail API", details: sendError.message },
        { status: 500 }
      );
    }

    // Update stored access token if it was refreshed
    if (tokenRefreshed) {
      try {
        const { encrypt } = await import('@/app/lib/encryption');
        const { updateProfile } = await import('@/app/lib/googleSheets');
        const newEncryptedToken = encrypt(accessToken);
        await updateProfile(session.clientId, {
          gmail_access_token: JSON.stringify(newEncryptedToken),
        });
      } catch (updateError) {
        console.error('Error updating access token:', updateError);
        // Don't fail the request if token update fails
      }
    }

    // Update connection status and store last sent message
    await updateConnection(connectionId, {
      status: 'email_sent',
      email_sent_at: new Date().toISOString(),
      last_sent_message: draft_message,
      email_status: 'sent', // sent, delivered (can be updated later via webhook or polling)
    });

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
    });

  } catch (error) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: "Failed to send email", details: error.message },
      { status: 500 }
    );
  }
}

