import { NextResponse } from "next/server";
import { getSheetData, SHEETS, getSheetsClient } from "@/app/lib/googleSheets";
import { requireAuth } from "@/app/lib/session";
import { normalizeRole } from "@/app/lib/roleUtils";
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { join } from 'path';

// Helper to convert column index to letter
const getColumnLetter = (index) => {
    let result = '';
    while (index >= 0) {
        result = String.fromCharCode(65 + (index % 26)) + result;
        index = Math.floor(index / 26) - 1;
    }
    return result;
};

function getSheetsClientInstance() {
    let credentials;
    if (process.env.GOOGLE_CREDENTIALS) {
        credentials = typeof process.env.GOOGLE_CREDENTIALS === 'string'
            ? JSON.parse(process.env.GOOGLE_CREDENTIALS)
            : process.env.GOOGLE_CREDENTIALS;
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
}

// PATCH - Update signal status
export async function PATCH(request) {
    try {
        // Require authentication
        const session = await requireAuth();
        const userRole = session.role || '';

        // Check if user is admin
        const normalizedRole = normalizeRole(userRole);
        const isAdmin = normalizedRole === 'Admin';

        if (!isAdmin) {
            return NextResponse.json(
                { error: "Forbidden: Only admins can update signal status" },
                { status: 403 }
            );
        }

        const { profile_id, signal_index, status } = await request.json();

        if (!profile_id) {
            return NextResponse.json(
                { error: "profile_id is required" },
                { status: 400 }
            );
        }

        if (signal_index === undefined || signal_index === null) {
            return NextResponse.json(
                { error: "signal_index is required" },
                { status: 400 }
            );
        }

        if (!status || !['Draft', 'Published'].includes(status)) {
            return NextResponse.json(
                { error: "Status must be either 'Draft' or 'Published'" },
                { status: 400 }
            );
        }

        const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
        if (!SPREADSHEET_ID) {
            throw new Error("GOOGLE_SHEET_ID environment variable is not set");
        }

        const sheets = getSheetsClientInstance();

        // Get all signals
        const allSignals = await getSheetData(SHEETS.SIGNALS);

        // Get headers to find status column
        const headersResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.SIGNALS}!1:1`,
        });
        const headers = headersResponse.data.values?.[0] || [];

        // Find status column index, create if it doesn't exist
        let statusColumnIndex = headers.findIndex(
            h => h && h.toLowerCase() === 'status'
        );

        if (statusColumnIndex === -1) {
            // Status column doesn't exist, add it
            statusColumnIndex = headers.length;
            const columnLetter = getColumnLetter(statusColumnIndex);

            // Add header
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.SIGNALS}!${columnLetter}1`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [['status']],
                },
            });
        }

        // Find signals for this profile_id
        const profileSignals = [];
        const signalRowIndices = [];

        for (let i = 0; i < allSignals.length; i++) {
            const signal = allSignals[i];
            const signalProfileId = signal.profile_id || signal["profile_id"] || signal["Profile ID"];
            if (signalProfileId && String(signalProfileId).trim() === String(profile_id).trim()) {
                profileSignals.push(signal);
                signalRowIndices.push(i);
            }
        }

        // Check if signal_index is valid
        if (signal_index < 0 || signal_index >= profileSignals.length) {
            return NextResponse.json(
                { error: "Signal index out of range" },
                { status: 404 }
            );
        }

        // Get the actual row index in the sheet
        const actualRowIndex = signalRowIndices[signal_index];

        // Update the status
        const rowNumber = actualRowIndex + 2; // +2 because: +1 for header row, +1 for 0-based index
        const columnLetter = getColumnLetter(statusColumnIndex);

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.SIGNALS}!${columnLetter}${rowNumber}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[status]],
            },
        });

        return NextResponse.json({
            success: true,
            message: "Signal status updated successfully",
            profile_id: profile_id,
            signal_index: signal_index,
            status: status,
        });

    } catch (error) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        console.error("Error updating signal status:", error);
        return NextResponse.json(
            { error: "Failed to update signal status", details: error.message },
            { status: 500 }
        );
    }
}

