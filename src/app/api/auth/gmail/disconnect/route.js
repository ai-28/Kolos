import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/session";
import { findRowById, updateProfile } from "@/app/lib/googleSheets";

export async function POST(request) {
  try {
    const session = await requireAuth();
    const profileId = session.clientId;

    if (!profileId) {
      return NextResponse.json(
        { error: "Profile ID not found" },
        { status: 400 }
      );
    }

    // Get profile to verify it exists
    const profile = await findRowById('Profiles', profileId);
    if (!profile) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // Remove Gmail connection info
    await updateProfile(profileId, {
      gmail_access_token: '',
      gmail_refresh_token: '',
      gmail_connected: 'false',
      gmail_connected_at: '',
    });

    return NextResponse.json({
      success: true,
      message: "Gmail account disconnected successfully",
    });
  } catch (error) {
    console.error('Gmail disconnect error:', error);
    return NextResponse.json(
      { error: "Failed to disconnect Gmail", details: error.message },
      { status: 500 }
    );
  }
}

