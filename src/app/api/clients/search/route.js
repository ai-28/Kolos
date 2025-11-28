import { NextResponse } from "next/server";
import { getSheetData, SHEETS } from "@/app/lib/googleSheets";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get("email");

        if (!email) {
            return NextResponse.json(
                { error: "Email parameter is required" },
                { status: 400 }
            );
        }

        // Get all profiles
        const profiles = await getSheetData(SHEETS.PROFILES);
        
        // Search for profile by email (case-insensitive)
        const profile = profiles.find(
            (p) => p.email && p.email.toLowerCase().trim() === email.toLowerCase().trim()
        );

        if (!profile) {
            return NextResponse.json(
                { error: "No profile found with this email", found: false },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            found: true,
            client: profile,
        });
    } catch (error) {
        console.error("Error searching for client:", error);
        return NextResponse.json(
            {
                error: "Failed to search for client",
                details: error.message,
            },
            { status: 500 }
        );
    }
}

