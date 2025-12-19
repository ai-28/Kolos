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
    USERS: 'Users',
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
        // Using A:AZ range to cover all columns we might write to (including 27th column AA)
        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A:AZ`, // Full range - append will find next empty row
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
            range: `${sheetName}!A:AZ`,
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

/**
 * Find user by email (case-insensitive matching)
 */
export async function findUserByEmail(email) {
    try {
        if (!email) {
            return null;
        }

        const data = await getSheetData(SHEETS.USERS);

        const found = data.find(row => {
            const emailFields = ['email', 'Email', 'EMAIL'];
            for (const field of emailFields) {
                if (row[field] && String(row[field]).toLowerCase().trim() === String(email).toLowerCase().trim()) {
                    return true;
                }
            }

            // Also check all fields case-insensitively
            for (const key in row) {
                if (key.toLowerCase() === 'email') {
                    if (row[key] && String(row[key]).toLowerCase().trim() === String(email).toLowerCase().trim()) {
                        return true;
                    }
                }
            }

            return false;
        });

        return found || null;
    } catch (error) {
        console.error(`Error finding user by email:`, error);
        throw error;
    }
}

/**
 * Helper function to get column letter from index (0 = A, 1 = B, etc.)
 */
function getColumnLetter(columnIndex) {
    let result = '';
    while (columnIndex >= 0) {
        result = String.fromCharCode(65 + (columnIndex % 26)) + result;
        columnIndex = Math.floor(columnIndex / 26) - 1;
    }
    return result;
}

/**
 * Update or create user entry with profile_id
 */
export async function updateOrCreateUserWithProfileId(email, profileId) {
    try {
        if (!SPREADSHEET_ID) {
            throw new Error('GOOGLE_SHEET_ID environment variable is not set');
        }

        if (!email) {
            throw new Error('Email is required');
        }

        const sheets = getSheetsClient();

        // Get all users data to find the user
        const data = await getSheetData(SHEETS.USERS);

        // Get headers to find column indices
        const headersResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.USERS}!1:1`,
        });
        const headers = headersResponse.data.values?.[0] || [];

        // Find user by email (case-insensitive)
        let userIndex = -1;
        let userRow = null;

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const emailFields = ['email', 'Email', 'EMAIL'];
            for (const field of emailFields) {
                if (row[field] && String(row[field]).toLowerCase().trim() === String(email).toLowerCase().trim()) {
                    userIndex = i;
                    userRow = row;
                    break;
                }
            }
            if (userIndex !== -1) break;

            // Also check all fields case-insensitively
            for (const key in row) {
                if (key.toLowerCase() === 'email') {
                    if (row[key] && String(row[key]).toLowerCase().trim() === String(email).toLowerCase().trim()) {
                        userIndex = i;
                        userRow = row;
                        break;
                    }
                }
            }
            if (userIndex !== -1) break;
        }

        // Find or create profile_id column
        let profileIdColumnIndex = headers.findIndex(
            h => h && (h.toLowerCase() === 'profile_id' || h.toLowerCase() === 'profile id' || h.toLowerCase() === 'profileid')
        );

        if (profileIdColumnIndex === -1) {
            // Column doesn't exist, add it
            profileIdColumnIndex = headers.length;
            const columnLetter = getColumnLetter(profileIdColumnIndex);

            // Add header
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.USERS}!${columnLetter}1`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [['profile_id']],
                },
            });
        }

        if (userIndex !== -1 && userRow) {
            // User exists, update profile_id
            const rowNumber = userIndex + 2; // +2 because: +1 for header row, +1 for 0-based index
            const columnLetter = getColumnLetter(profileIdColumnIndex);

            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.USERS}!${columnLetter}${rowNumber}`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [[profileId]],
                },
            });

            console.log(`✅ Updated user profile_id for email: ${email}`);
        } else {
            // User doesn't exist, create new user entry
            // Find email column index
            let emailColumnIndex = headers.findIndex(
                h => h && h.toLowerCase() === 'email'
            );

            if (emailColumnIndex === -1) {
                // Email column doesn't exist, add it as first column
                emailColumnIndex = 0;
                // We'll need to shift other columns, but for simplicity, let's just append
                // In practice, you might want to handle this more carefully
            }

            // Create new user row
            const newUserRow = new Array(Math.max(headers.length, profileIdColumnIndex + 1)).fill('');

            // Set email
            if (emailColumnIndex >= 0) {
                newUserRow[emailColumnIndex] = email;
            } else {
                newUserRow[0] = email;
            }

            // Set profile_id
            newUserRow[profileIdColumnIndex] = profileId;

            await appendToSheet(SHEETS.USERS, newUserRow);
            console.log(`✅ Created new user entry with profile_id for email: ${email}`);
        }

        return { success: true };
    } catch (error) {
        console.error(`❌ Error updating/creating user with profile_id:`, error);
        throw error;
    }
}

/**
 * Update signal LinkedIn URL by finding the signal row
 * Uses profile_id, headline_source, and date to identify the signal
 */
export async function updateSignalLinkedInUrl(profileId, headlineSource, date, linkedinUrl) {
    try {
        if (!SPREADSHEET_ID) {
            throw new Error('GOOGLE_SHEET_ID environment variable is not set');
        }

        const sheets = getSheetsClient();

        // Get all signals to find the matching one
        const signals = await getSheetData(SHEETS.SIGNALS);

        // Get headers to find column indices
        const headersResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.SIGNALS}!1:1`,
        });
        const headers = headersResponse.data.values?.[0] || [];

        // Find the signal row
        let signalRowIndex = -1;
        for (let i = 0; i < signals.length; i++) {
            const signal = signals[i];
            // Match by profile_id, headline_source, and date
            const profileIdMatch = (signal.profile_id || signal['Profile ID'] || signal['profile_id'] || '').toString().trim() === profileId.toString().trim();
            const headlineMatch = (signal.headline_source || signal['Headline Source'] || signal['headline_source'] || '').toString().trim() === headlineSource.toString().trim();
            const dateMatch = (signal.date || signal['Date'] || '').toString().trim() === date.toString().trim();

            if (profileIdMatch && headlineMatch && dateMatch) {
                signalRowIndex = i;
                break;
            }
        }

        if (signalRowIndex === -1) {
            console.warn(`⚠️ Signal not found for update: profile_id=${profileId}, headline=${headlineSource?.substring(0, 50)}`);
            return { success: false, message: 'Signal not found' };
        }

        // Find LinkedIn URL column index
        let linkedinColumnIndex = headers.findIndex(
            h => h && (h.toLowerCase().includes('linkedin') || h.toLowerCase() === 'decision_maker_linkedin_url')
        );

        if (linkedinColumnIndex === -1) {
            // LinkedIn column is typically the 11th column (index 10) based on signalRow structure
            // profile_id, date, headline_source, url, signal_type, scores_R_O_A, overall, next_step, 
            // decision_maker_role, decision_maker_name, decision_maker_linkedin_url
            linkedinColumnIndex = 10; // Adjust based on your actual column order
        }

        // Update the LinkedIn URL
        const rowNumber = signalRowIndex + 2; // +2 because: +1 for header row, +1 for 0-based index
        const columnLetter = getColumnLetter(linkedinColumnIndex);

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.SIGNALS}!${columnLetter}${rowNumber}`,
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [[linkedinUrl]],
            },
        });

        return { success: true };
    } catch (error) {
        console.error(`❌ Error updating signal LinkedIn URL:`, error);
        return { success: false, error: error.message };
    }
}

export { SHEETS };

