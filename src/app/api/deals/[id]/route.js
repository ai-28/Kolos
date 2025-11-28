import { NextResponse } from "next/server";
import { getSheetData, SHEETS } from "@/app/lib/googleSheets";
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

// PUT - Update deal by deal_id
export async function PUT(request, { params }) {
    try {
        const { id } = await params;
        const updateData = await request.json();

        if (!id) {
            return NextResponse.json(
                { error: "Deal ID is required" },
                { status: 400 }
            );
        }

        // Get all deals to find the row number
        const deals = await getSheetData(SHEETS.DEALS);
        const dealIndex = deals.findIndex(
            (d) => {
                const dealId = d.deal_id || d["deal_id"] || d.id || d["id"];
                return dealId && String(dealId).trim() === String(id).trim();
            }
        );

        if (dealIndex === -1) {
            return NextResponse.json(
                { error: "Deal not found" },
                { status: 404 }
            );
        }

        // Get headers to map fields to columns
        const sheets = getSheetsClient();
        const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

        const headersResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.DEALS}!1:1`,
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
                // Row number is dealIndex + 2 (1 for header, 1 for 0-based index)
                const rowNumber = dealIndex + 2;
                const columnLetter = getColumnLetter(columnIndex);

                updates.push({
                    range: `${SHEETS.DEALS}!${columnLetter}${rowNumber}`,
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

        // Fetch updated deal data
        const updatedDeals = await getSheetData(SHEETS.DEALS);
        const updatedDeal = updatedDeals.find(
            (d) => {
                const dealId = d.deal_id || d["deal_id"] || d.id || d["id"];
                return dealId && String(dealId).trim() === String(id).trim();
            }
        );

        return NextResponse.json({
            success: true,
            message: "Deal updated successfully",
            deal: updatedDeal,
        });
    } catch (error) {
        console.error("Error updating deal:", error);
        return NextResponse.json(
            {
                error: "Failed to update deal",
                details: error.message,
            },
            { status: 500 }
        );
    }
}

// DELETE - Delete deal by deal_id
export async function DELETE(request, { params }) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                { error: "Deal ID is required" },
                { status: 400 }
            );
        }

        // Get all deals to find the row number
        const deals = await getSheetData(SHEETS.DEALS);
        const dealIndex = deals.findIndex(
            (d) => {
                const dealId = d.deal_id || d["deal_id"] || d.id || d["id"];
                return dealId && String(dealId).trim() === String(id).trim();
            }
        );

        if (dealIndex === -1) {
            return NextResponse.json(
                { error: "Deal not found" },
                { status: 404 }
            );
        }

        // Delete the row using batchUpdate to delete the entire row
        const sheets = getSheetsClient();
        const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

        if (!SPREADSHEET_ID) {
            throw new Error("GOOGLE_SHEET_ID environment variable is not set");
        }

        // Get sheet ID (cached if possible, but we'll optimize the call)
        console.log(`Deleting deal row ${dealIndex + 2} for deal_id: ${id}`);
        const sheetId = await getSheetId(SPREADSHEET_ID, SHEETS.DEALS, sheets);

        // Row number is dealIndex + 2 (1 for header, 1 for 0-based index)
        const rowNumber = dealIndex + 2;

        console.log(`Attempting to delete row ${rowNumber} in sheet ${SHEETS.DEALS} (sheetId: ${sheetId})`);

        // Delete the row using deleteDimension
        const deleteResponse = await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'ROWS',
                            startIndex: rowNumber - 1, // 0-based index (rowNumber - 1 because we have header)
                            endIndex: rowNumber
                        }
                    }
                }]
            }
        });

        console.log(`✅ Successfully deleted row ${rowNumber}`);

        return NextResponse.json({
            success: true,
            message: "Deal deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting deal:", error);
        return NextResponse.json(
            {
                error: "Failed to delete deal",
                details: error.message,
            },
            { status: 500 }
        );
    }
}

// Helper function to get sheet ID by name
async function getSheetId(spreadsheetId, sheetName, sheets) {
    try {
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: spreadsheetId,
        });

        const sheet = spreadsheet.data.sheets.find(
            (s) => s.properties.title === sheetName
        );

        if (!sheet) {
            throw new Error(`Sheet "${sheetName}" not found`);
        }

        return sheet.properties.sheetId;
    } catch (error) {
        console.error("Error getting sheet ID:", error);
        throw error;
    }
}

