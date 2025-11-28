import { google } from 'googleapis';

// Initialize Google Sheets client
function getSheetsClient() {
    const auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_CREDENTIALS_PATH || './google-credentials.json',
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    return google.sheets({ version: 'v4', auth });
}

// Get sheet ID from environment
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

// Table names (sheet names in your Google Sheet)
const SHEETS = {
    PROFILES: 'Profiles',
    SIGNALS: 'Signals',
    DEALS: 'Deals',
};

/**
 * Append a row to a sheet
 */
export async function appendToSheet(sheetName, values) {
    try {
        const sheets = getSheetsClient();
        
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:Z`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [values],
            },
        });

        return { success: true };
    } catch (error) {
        console.error(`Error appending to ${sheetName}:`, error);
        throw error;
    }
}

/**
 * Get all rows from a sheet
 */
export async function getSheetData(sheetName) {
    try {
        const sheets = getSheetsClient();
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:Z`,
        });

        const rows = response.data.values || [];
        
        if (rows.length === 0) {
            return [];
        }

        // First row is headers
        const headers = rows[0];
        const data = rows.slice(1).map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = row[index] || null;
            });
            return obj;
        });

        return data;
    } catch (error) {
        console.error(`Error reading from ${sheetName}:`, error);
        throw error;
    }
}

/**
 * Find a row by ID (assuming first column is ID or profile_id)
 */
export async function findRowById(sheetName, id) {
    try {
        const data = await getSheetData(sheetName);
        return data.find(row => row.id === id || row.profile_id === id);
    } catch (error) {
        console.error(`Error finding row in ${sheetName}:`, error);
        throw error;
    }
}

/**
 * Find rows by profile_id
 */
export async function findRowsByProfileId(sheetName, profileId) {
    try {
        const data = await getSheetData(sheetName);
        return data.filter(row => row.profile_id === profileId);
    } catch (error) {
        console.error(`Error finding rows by profile_id in ${sheetName}:`, error);
        throw error;
    }
}

export { SHEETS };

