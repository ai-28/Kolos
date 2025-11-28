import { NextResponse } from "next/server";
import { findRowById, SHEETS } from "@/app/lib/googleSheets";

export async function GET(request, { params }) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                { error: "Client ID is required" },
                { status: 400 }
            );
        }

        const client = await findRowById(SHEETS.PROFILES, id);

        if (!client) {
            return NextResponse.json(
                { error: "Client not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            client,
        });
    } catch (error) {
        console.error("Error fetching client from Google Sheets:", error);

        return NextResponse.json(
            {
                error: "Failed to fetch client",
                details: error.message,
            },
            { status: 500 }
        );
    }
}

