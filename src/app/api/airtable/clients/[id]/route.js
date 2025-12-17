import { NextResponse } from "next/server";
import { findRowById, getSheetData, SHEETS } from "@/app/lib/googleSheets";
import { requireAuth } from "@/app/lib/session";
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { join } from 'path';

// Helper to get sheets client
function getSheetsClient() {
    try {
        let credentials;

        if (process.env.GOOGLE_CREDENTIALS) {
            try {
                credentials = typeof process.env.GOOGLE_CREDENTIALS === 'string'
                    ? JSON.parse(process.env.GOOGLE_CREDENTIALS)
                    : process.env.GOOGLE_CREDENTIALS;
            } catch (parseError) {
                throw new Error(`Failed to parse GOOGLE_CREDENTIALS: ${parseError.message}`);
            }
        } else {
            const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || 'kolos-project-40696a085f6e.json';
            const fullPath = credentialsPath.startsWith('/') || credentialsPath.startsWith('C:') || credentialsPath.startsWith('E:')
                ? credentialsPath
                : join(process.cwd(), credentialsPath.replace(/^\.\//, ''));
            const credentialsFile = readFileSync(fullPath, 'utf8');
            credentials = JSON.parse(credentialsFile);
        }

        const auth = new google.auth.GoogleAuth({
            credentials: credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        return google.sheets({ version: 'v4', auth });
    } catch (error) {
        console.error('Error initializing Google Sheets client:', error);
        throw error;
    }
}

// GET - Fetch client by ID (must match session client_id)
export async function GET(request, { params }) {
    try {
        // Get client_id from session
        const session = await requireAuth();
        const sessionClientId = session.clientId;

        const { id } = await params;

        // Users can only access their own profile
        if (id !== sessionClientId) {
            return NextResponse.json(
                { error: "Forbidden" },
                { status: 403 }
            );
        }

        console.log(`Searching for client with ID: ${id}`);

        let client = await findRowById(SHEETS.PROFILES, id);

        if (!client) {
            console.log(`Client not found by ID, trying email search...`);
            const profiles = await getSheetData(SHEETS.PROFILES);
            client = profiles.find(
                (p) => p.email && p.email.toLowerCase().trim() === id.toLowerCase().trim()
            );
        }

        if (!client) {
            console.log(`Client not found with ID/email: ${id}`);
            return NextResponse.json(
                { error: "Client not found" },
                { status: 404 }
            );
        }

        console.log(`✅ Client found:`, { id: client.id, email: client.email, name: client.name });

        return NextResponse.json({
            success: true,
            client,
        });
    } catch (error) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
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

// PUT - Update client profile (must match session client_id)
export async function PUT(request, { params }) {
    try {
        // Get client_id from session
        const session = await requireAuth();
        const sessionClientId = session.clientId;

        const { id } = await params;

        // Users can only update their own profile
        if (id !== sessionClientId) {
            return NextResponse.json(
                { error: "Forbidden" },
                { status: 403 }
            );
        }

        // Get the client to find the row number
        const profiles = await getSheetData(SHEETS.PROFILES);
        const clientIndex = profiles.findIndex(
            (p) => {
                const clientId = p.id || p.ID || p["id"] || p["ID"];
                return clientId && String(clientId).trim() === String(id).trim();
            }
        );

        if (clientIndex === -1) {
            return NextResponse.json(
                { error: "Client not found" },
                { status: 404 }
            );
        }

        // Get headers to map fields to columns
        const sheets = getSheetsClient();
        const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

        const headersResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.PROFILES}!1:1`,
        });

        const headers = headersResponse.data.values?.[0] || [];

        // Helper function to convert column index to letter (A, B, ..., Z, AA, AB, etc.)
        const getColumnLetter = (index) => {
            let result = '';
            while (index >= 0) {
                result = String.fromCharCode(65 + (index % 26)) + result;
                index = Math.floor(index / 26) - 1;
            }
            return result;
        };

        // Map update data to column indices
        const updates = [];
        for (const [field, value] of Object.entries(updateData)) {
            const columnIndex = headers.findIndex(
                h => h && h.toLowerCase() === field.toLowerCase()
            );

            if (columnIndex !== -1) {
                // Row number is clientIndex + 2 (1 for header, 1 for 0-based index)
                const rowNumber = clientIndex + 2;
                const columnLetter = getColumnLetter(columnIndex);

                updates.push({
                    range: `${SHEETS.PROFILES}!${columnLetter}${rowNumber}`,
                    values: [[value || '']],
                });
            }
        }

        if (updates.length === 0) {
            return NextResponse.json(
                { error: "No valid fields to update" },
                { status: 400 }
            );
        }

        // Batch update
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: updates,
            },
        });

        // Fetch updated client data
        const updatedClient = await findRowById(SHEETS.PROFILES, id);

        return NextResponse.json({
            success: true,
            message: "Client profile updated successfully",
            client: updatedClient,
        });
    } catch (error) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        console.error("Error updating client:", error);
        return NextResponse.json(
            {
                error: "Failed to update client",
                details: error.message,
            },
            { status: 500 }
        );
    }
}
