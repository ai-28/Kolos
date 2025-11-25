import { NextResponse } from "next/server";
import Airtable from "airtable";

export async function GET(request, { params }) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                { error: "Client ID is required" },
                { status: 400 }
            );
        }

        // Initialize Airtable
        const base = new Airtable({
            apiKey: process.env.AIRTABLE_API_KEY,
        }).base(process.env.AIRTABLE_BASE_ID);

        // Get the table name from environment or use default
        const tableName = process.env.AIRTABLE_TABLE_NAME || "Clients";

        // Fetch the specific record by ID
        const record = await base(tableName).find(id);

        if (!record) {
            return NextResponse.json(
                { error: "Client not found" },
                { status: 404 }
            );
        }

        const client = {
            id: record.id,
            ...record.fields,
            createdAt: record._rawJson.createdTime,
        };

        return NextResponse.json({
            success: true,
            client,
        });
    } catch (error) {
        console.error("Error fetching client from Airtable:", error);

        if (error.error === "NOT_FOUND") {
            return NextResponse.json(
                { error: "Client not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            {
                error: "Failed to fetch client",
                details: error.message,
            },
            { status: 500 }
        );
    }
}

