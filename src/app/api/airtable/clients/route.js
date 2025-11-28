import { NextResponse } from "next/server";
import { getSheetData, SHEETS } from "@/app/lib/googleSheets";

export async function GET(request) {
    try {
        const clients = await getSheetData(SHEETS.PROFILES);

        return NextResponse.json({
            success: true,
            clients,
            count: clients.length,
        });
    } catch (error) {
        console.error("Error fetching clients from Google Sheets:", error);
        return NextResponse.json(
            {
                error: "Failed to fetch clients",
                details: error.message,
            },
            { status: 500 }
        );
    }
}

