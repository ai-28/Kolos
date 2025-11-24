import { NextResponse } from "next/server";
import Airtable from "airtable";

export async function GET(request) {
    try {
        // Initialize Airtable
        const base = new Airtable({
            apiKey: process.env.AIRTABLE_API_KEY,
        }).base(process.env.AIRTABLE_BASE_ID);

        // Get the table name from environment or use default
        const tableName = process.env.AIRTABLE_TABLE_NAME || "Clients";

        // Fetch all records from Airtable
        const records = await base(tableName).select({
            // Fetch all fields
            view: "Grid view",
        }).all();

        const clients = records.map((record) => {
            const fields = record.fields;

            const client = {
                id: record.id,
                ...fields,
                createdAt: record._rawJson.createdTime,
            };

            return client;
        });

        return NextResponse.json({
            success: true,
            clients,
            count: clients.length,
        });
    } catch (error) {
        console.error("Error fetching clients from Airtable:", error);
        return NextResponse.json(
            {
                error: "Failed to fetch clients",
                details: error.message,
            },
            { status: 500 }
        );
    }
}

