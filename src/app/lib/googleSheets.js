import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { join } from 'path';

// Initialize Google Sheets client
export function getSheetsClient() {
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
    CONNECTIONS: 'Connections',
};

/**
 * Append a row to a sheet
 */
export async function appendToSheet(sheetName, values) {
    try {
        if (!SPREADSHEET_ID) {
            throw new Error('GOOGLE_SHEET_ID environment variable is not set');
        }

        // Validate values array is not empty
        if (!values || !Array.isArray(values) || values.length === 0) {
            throw new Error(`Cannot append empty values array to ${sheetName}`);
        }

        // Validate first value is not empty (critical for Connections sheet)
        if (sheetName === SHEETS.CONNECTIONS && (!values[0] || values[0].toString().trim() === '')) {
            throw new Error(`First field (connection_id) cannot be empty when appending to ${sheetName}`);
        }

        const sheets = getSheetsClient();

        // Log what we're appending (first few fields for debugging)
        console.log(`📤 Appending to ${sheetName}:`, {
            totalFields: values.length,
            firstField: values[0],
            secondField: values[1],
            thirdField: values[2]
        });

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
        console.log(`   First field written: ${values[0]}`);
        return { success: true, response };
    } catch (error) {
        console.error(`❌ Error appending to ${sheetName}:`, error);
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            response: error.response?.data,
            valuesLength: values?.length,
            firstValue: values?.[0]
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
            valueRenderOption: 'FORMATTED_VALUE', // Get formatted values (removes apostrophe prefix if present)
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
 * Update or create user entry with profile_id and role
 */
export async function updateOrCreateUserWithProfileId(email, profileId, role = '') {
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

        // Find or create client_id column (save profile_id value to client_id column)
        let clientIdColumnIndex = headers.findIndex(
            h => h && (h.toLowerCase() === 'client_id' || h.toLowerCase() === 'client id' || h.toLowerCase() === 'clientid' || h.toLowerCase() === 'id')
        );

        if (clientIdColumnIndex === -1) {
            // Column doesn't exist, add it
            clientIdColumnIndex = headers.length;
            const columnLetter = getColumnLetter(clientIdColumnIndex);

            // Add header
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.USERS}!${columnLetter}1`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [['client_id']],
                },
            });
        }

        // Find or create role column
        let roleColumnIndex = headers.findIndex(
            h => h && h.toLowerCase() === 'role'
        );

        if (roleColumnIndex === -1) {
            // Column doesn't exist, add it
            roleColumnIndex = headers.length;
            const columnLetter = getColumnLetter(roleColumnIndex);

            // Add header
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.USERS}!${columnLetter}1`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [['role']],
                },
            });
        }

        if (userIndex !== -1 && userRow) {
            // User exists, update client_id and role
            const rowNumber = userIndex + 2; // +2 because: +1 for header row, +1 for 0-based index

            // Update client_id
            const clientIdColumnLetter = getColumnLetter(clientIdColumnIndex);
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `${SHEETS.USERS}!${clientIdColumnLetter}${rowNumber}`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [[profileId]], // Save profile_id value to client_id column
                },
            });

            // Update role if provided
            if (role) {
                const roleColumnLetter = getColumnLetter(roleColumnIndex);
                await sheets.spreadsheets.values.update({
                    spreadsheetId: SPREADSHEET_ID,
                    range: `${SHEETS.USERS}!${roleColumnLetter}${rowNumber}`,
                    valueInputOption: 'USER_ENTERED',
                    resource: {
                        values: [[role]],
                    },
                });
            }

            console.log(`✅ Updated user client_id (with profile_id: ${profileId}) and role for email: ${email}`);
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
            const maxColumnIndex = Math.max(headers.length, clientIdColumnIndex + 1, roleColumnIndex + 1);
            const newUserRow = new Array(maxColumnIndex).fill('');

            // Set email
            if (emailColumnIndex >= 0) {
                newUserRow[emailColumnIndex] = email;
            } else {
                newUserRow[0] = email;
            }

            // Set client_id with profile_id value
            newUserRow[clientIdColumnIndex] = profileId;

            // Set role if provided
            if (role) {
                newUserRow[roleColumnIndex] = role;
            }

            await appendToSheet(SHEETS.USERS, newUserRow);
            console.log(`✅ Created new user entry with email: ${email}, client_id (profile_id: ${profileId}), role: ${role || 'N/A'}`);
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

/**
 * Find connections by user ID (from_user_id or to_user_id)
 */
export async function findConnectionsByUserId(userId) {
    try {
        if (!userId) {
            return [];
        }

        const data = await getSheetData(SHEETS.CONNECTIONS);

        return data.filter(row => {
            const fromUserId = row.from_user_id || row['from_user_id'] || row['From User ID'];
            const toUserId = row.to_user_id || row['to_user_id'] || row['To User ID'];

            return (fromUserId && String(fromUserId).trim() === String(userId).trim()) ||
                (toUserId && String(toUserId).trim() === String(userId).trim());
        });
    } catch (error) {
        console.error('Error finding connections by user ID:', error);
        throw error;
    }
}

/**
 * Find connection between two users
 */
export async function findConnectionBetweenUsers(fromUserId, toUserId) {
    try {
        if (!fromUserId || !toUserId) {
            return null;
        }

        const data = await getSheetData(SHEETS.CONNECTIONS);

        return data.find(row => {
            const fromId = row.from_user_id || row['from_user_id'] || row['From User ID'];
            const toId = row.to_user_id || row['to_user_id'] || row['To User ID'];

            return (fromId && String(fromId).trim() === String(fromUserId).trim() &&
                toId && String(toId).trim() === String(toUserId).trim()) ||
                (fromId && String(fromId).trim() === String(toUserId).trim() &&
                    toId && String(toId).trim() === String(fromUserId).trim());
        }) || null;
    } catch (error) {
        console.error('Error finding connection between users:', error);
        throw error;
    }
}

/**
 * Find connections by deal ID
 */
export async function findConnectionsByDealId(dealId) {
    try {
        if (!dealId) {
            return [];
        }

        const data = await getSheetData(SHEETS.CONNECTIONS);

        return data.filter(row => {
            const dealIdField = row.deal_id || row['deal_id'] || row['Deal ID'];
            return dealIdField && String(dealIdField).trim() === String(dealId).trim();
        });
    } catch (error) {
        console.error('Error finding connections by deal ID:', error);
        throw error;
    }
}

/**
 * Update connection row by connection_id
 */
export async function updateConnection(connectionId, updates) {
    try {
        if (!SPREADSHEET_ID) {
            throw new Error('GOOGLE_SHEET_ID environment variable is not set');
        }

        const sheets = getSheetsClient();
        const connections = await getSheetData(SHEETS.CONNECTIONS);

        // Find connection by connection_id
        const connectionIndex = connections.findIndex(conn => {
            const connId = conn.connection_id || conn['connection_id'] || conn['Connection ID'];
            return connId && String(connId).trim() === String(connectionId).trim();
        });

        if (connectionIndex === -1) {
            throw new Error(`Connection not found: ${connectionId}`);
        }

        // Get headers
        const headersResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.CONNECTIONS}!1:1`,
        });
        const headers = headersResponse.data.values?.[0] || [];

        // Helper function to convert column index to letter
        const getColumnLetter = (index) => {
            let result = '';
            while (index >= 0) {
                result = String.fromCharCode(65 + (index % 26)) + result;
                index = Math.floor(index / 26) - 1;
            }
            return result;
        };

        // Map updates to column indices
        const updateRequests = [];
        for (const [field, value] of Object.entries(updates)) {
            const columnIndex = headers.findIndex(
                h => h && h.toLowerCase() === field.toLowerCase()
            );

            if (columnIndex !== -1) {
                const rowNumber = connectionIndex + 2; // +2 because: 1 for header, 1 for 0-based index
                const columnLetter = getColumnLetter(columnIndex);

                updateRequests.push({
                    range: `${SHEETS.CONNECTIONS}!${columnLetter}${rowNumber}`,
                    values: [[value !== null && value !== undefined ? value : '']],
                });
            }
        }

        if (updateRequests.length === 0) {
            throw new Error('No valid fields to update');
        }

        // Batch update
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: updateRequests,
            },
        });

        // Fetch and return updated connection
        const updatedConnections = await getSheetData(SHEETS.CONNECTIONS);
        const updatedConnection = updatedConnections.find(conn => {
            const connId = conn.connection_id || conn['connection_id'] || conn['Connection ID'];
            return connId && String(connId).trim() === String(connectionId).trim();
        });

        return updatedConnection;
    } catch (error) {
        console.error('Error updating connection:', error);
        throw error;
    }
}

/**
 * Find connection by connection_id
 */
export async function findConnectionById(connectionId) {
    try {
        const data = await getSheetData(SHEETS.CONNECTIONS);
        return data.find(conn => {
            const connId = conn.connection_id || conn['connection_id'] || conn['Connection ID'];
            return connId && String(connId).trim() === String(connectionId).trim();
        }) || null;
    } catch (error) {
        console.error('Error finding connection by ID:', error);
        throw error;
    }
}

/**
 * Get all connections (for admin)
 */
export async function getAllConnections() {
    try {
        return await getSheetData(SHEETS.CONNECTIONS);
    } catch (error) {
        console.error('Error getting all connections:', error);
        throw error;
    }
}

/**
 * Update profile row by profile ID
 */
export async function updateProfile(profileId, updates) {
    try {
        if (!SPREADSHEET_ID) {
            throw new Error('GOOGLE_SHEET_ID environment variable is not set');
        }

        const sheets = getSheetsClient();
        const profiles = await getSheetData(SHEETS.PROFILES);

        // Find profile by ID
        const profileIndex = profiles.findIndex(profile => {
            const id = profile.id || profile.ID || profile['id'] || profile['ID'] || profile.profile_id || profile['profile_id'];
            return id && String(id).trim() === String(profileId).trim();
        });

        if (profileIndex === -1) {
            throw new Error(`Profile not found: ${profileId}`);
        }

        // Get headers
        const headersResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.PROFILES}!1:1`,
        });
        const headers = headersResponse.data.values?.[0] || [];

        // Helper function to convert column index to letter
        const getColumnLetter = (index) => {
            let result = '';
            while (index >= 0) {
                result = String.fromCharCode(65 + (index % 26)) + result;
                index = Math.floor(index / 26) - 1;
            }
            return result;
        };

        // Map updates to column indices
        const updateRequests = [];
        for (const [field, value] of Object.entries(updates)) {
            const columnIndex = headers.findIndex(
                h => h && h.toLowerCase() === field.toLowerCase()
            );

            if (columnIndex !== -1) {
                const rowNumber = profileIndex + 2; // +2 because: 1 for header, 1 for 0-based index
                const columnLetter = getColumnLetter(columnIndex);

                updateRequests.push({
                    range: `${SHEETS.PROFILES}!${columnLetter}${rowNumber}`,
                    values: [[value !== null && value !== undefined ? value : '']],
                });
            } else {
                // Column doesn't exist, we'll need to add it
                // For now, just log a warning
                console.warn(`Column "${field}" not found in Profiles sheet. Skipping update.`);
            }
        }

        if (updateRequests.length === 0) {
            throw new Error('No valid fields to update');
        }

        // Batch update
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: updateRequests,
            },
        });

        console.log(`✅ Updated profile ${profileId} with ${updateRequests.length} fields`);

        // Fetch and return updated profile
        const updatedProfiles = await getSheetData(SHEETS.PROFILES);
        const updatedProfile = updatedProfiles.find(profile => {
            const id = profile.id || profile.ID || profile['id'] || profile['ID'] || profile.profile_id || profile['profile_id'];
            return id && String(id).trim() === String(profileId).trim();
        });

        return updatedProfile;
    } catch (error) {
        console.error('Error updating profile:', error);
        throw error;
    }
}

export { SHEETS };

