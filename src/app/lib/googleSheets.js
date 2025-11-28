import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { join } from 'path';

// Initialize Google Sheets client
function getSheetsClient() {
    try {
        let credentials;

        // Priority 1: Try environment variable first (for production/serverless)
        if (process.env.GOOGLE_CREDENTIALS) {
            try {
                credentials = typeof process.env.GOOGLE_CREDENTIALS === 'string'
                    ? JSON.parse(process.env.GOOGLE_CREDENTIALS)
                    : process.env.GOOGLE_CREDENTIALS;
                console.log('✅ Using credentials from GOOGLE_CREDENTIALS environment variable');
            } catch (parseError) {
                throw new Error(`Failed to parse GOOGLE_CREDENTIALS: ${parseError.message}`);
            }
        }
        // Priority 2: Try reading from file (for local development)
        else {
            const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || 'kolos-project-40696a085f6e.json';

            try {
                // Handle both relative and absolute paths
                const fullPath = credentialsPath.startsWith('/') || credentialsPath.startsWith('C:') || credentialsPath.startsWith('E:')
                    ? credentialsPath
                    : join(process.cwd(), credentialsPath.replace(/^\.\//, ''));

                console.log(`Reading credentials from file: ${fullPath}`);
                const credentialsFile = readFileSync(fullPath, 'utf8');
                credentials = JSON.parse(credentialsFile);
                console.log('✅ Using credentials from file');
            } catch (fileError) {
                throw new Error(
                    `Could not read credentials file: ${credentialsPath}. ` +
                    `Error: ${fileError.message}. ` +
                    `For production, set GOOGLE_CREDENTIALS environment variable with the JSON content.`
                );
            }
        }

        if (!credentials) {
            throw new Error('No credentials found. Set GOOGLE_CREDENTIALS environment variable or provide a valid credentials file.');
        }

        const auth = new google.auth.GoogleAuth({
            credentials: credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        return google.sheets({ version: 'v4', auth });
    } catch (error) {
        console.error('❌ Error initializing Google Sheets client:', error);
        throw error;
    }
}

// Get sheet ID from environment
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

if (!SPREADSHEET_ID) {
    console.warn('⚠️ GOOGLE_SHEET_ID environment variable is not set!');
}

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
        if (!SPREADSHEET_ID) {
            throw new Error('GOOGLE_SHEET_ID environment variable is not set');
        }

        const sheets = getSheetsClient();

        // Append will automatically find the next empty row after existing data
        // Using A:Z range to cover all columns we might write to
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:Z`, // Full range - append will find next empty row
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: [values],
            },
        });

        console.log(`✅ Successfully appended row to ${sheetName} sheet`);
        return { success: true, response };
    } catch (error) {
        console.error(`❌ Error appending to ${sheetName}:`, error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            response: error.response?.data,
        });
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
 * Find a row by ID (checking multiple possible ID field names)
 */
export async function findRowById(sheetName, id) {
    try {
        if (!id) {
            return null;
        }

        const data = await getSheetData(sheetName);

        // Try multiple possible ID field names (case-insensitive)
        const found = data.find(row => {
            // Check common ID field names
            const idFields = ['id', 'ID', 'Id', 'profile_id', 'profileId', 'Profile ID'];

            for (const field of idFields) {
                if (row[field] && String(row[field]).trim() === String(id).trim()) {
                    return true;
                }
            }

            // Also check all fields case-insensitively
            for (const key in row) {
                if (key.toLowerCase() === 'id' || key.toLowerCase() === 'profile_id') {
                    if (row[key] && String(row[key]).trim() === String(id).trim()) {
                        return true;
                    }
                }
            }

            return false;
        });

        return found || null;
    } catch (error) {
        console.error(`Error finding row in ${sheetName}:`, error);
        throw error;
    }
}

/**
 * Find rows by profile_id (case-insensitive matching)
 */
export async function findRowsByProfileId(sheetName, profileId) {
    try {
        if (!profileId) {
            return [];
        }

        const data = await getSheetData(sheetName);

        // Filter by profile_id, checking multiple possible field names
        return data.filter(row => {
            // Check common profile_id field names
            const profileIdFields = ['profile_id', 'profileId', 'Profile ID', 'Profile_ID'];

            for (const field of profileIdFields) {
                if (row[field] && String(row[field]).trim() === String(profileId).trim()) {
                    return true;
                }
            }

            // Also check all fields case-insensitively
            for (const key in row) {
                if (key.toLowerCase() === 'profile_id') {
                    if (row[key] && String(row[key]).trim() === String(profileId).trim()) {
                        return true;
                    }
                }
            }

            return false;
        });
    } catch (error) {
        console.error(`Error finding rows by profile_id in ${sheetName}:`, error);
        throw error;
    }
}

export { SHEETS };

