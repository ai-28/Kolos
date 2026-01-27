import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      return NextResponse.json(
        { error: "GOOGLE_CLIENT_ID environment variable is not set" },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    (request.headers.get('origin') || request.headers.get('referer')?.split('/').slice(0, 3).join('/'));
    
    const redirectUri = `${baseUrl}/api/auth/gmail/callback`;
    // Scopes: gmail.send for sending emails, userinfo.email to get the connected Gmail account email
    const scope = 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email';
    const responseType = 'code';
    const accessType = 'offline';
    const prompt = 'consent';
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=${responseType}&` +
      `scope=${encodeURIComponent(scope)}&` +
      `access_type=${accessType}&` +
      `prompt=${prompt}`;
    
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating OAuth URL:', error);
    return NextResponse.json(
      { error: "Failed to generate OAuth URL", details: error.message },
      { status: 500 }
    );
  }
}

