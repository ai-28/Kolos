import { getSheetsClient, SHEETS } from './googleSheets';

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

/**
 * Append connection row to Connections sheet with proper column mapping
 * This ensures data goes to the correct columns regardless of sheet structure
 */
export async function appendConnectionToSheet(connectionData) {
    try {
        if (!SPREADSHEET_ID) {
            throw new Error('GOOGLE_SHEET_ID environment variable is not set');
        }

        const sheets = getSheetsClient();

        // Get headers to find correct column indices
        const headersResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.CONNECTIONS}!1:1`,
        });
        const headers = headersResponse.data.values?.[0] || [];

        // Helper function to find column index (case-insensitive)
        const findColumnIndex = (fieldName) => {
            return headers.findIndex(h => {
                if (!h) return false;
                const headerLower = h.toString().toLowerCase().trim();
                const fieldLower = fieldName.toLowerCase().trim();
                return headerLower === fieldLower || 
                       headerLower === fieldLower.replace(/_/g, ' ') ||
                       headerLower === fieldLower.replace(/_/g, '');
            });
        };

        // Map field names to column indices
        const columnMap = {
            'connection_id': findColumnIndex('connection_id'),
            'from_user_id': findColumnIndex('from_user_id'),
            'to_user_id': findColumnIndex('to_user_id'),
            'deal_id': findColumnIndex('deal_id'),
            'from_user_name': findColumnIndex('from_user_name'),
            'to_user_name': findColumnIndex('to_user_name'),
            'from_user_linkedin': findColumnIndex('from_user_linkedin'),
            'to_user_linkedin': findColumnIndex('to_user_linkedin'),
            'from_user_email': findColumnIndex('from_user_email'),
            'to_user_email': findColumnIndex('to_user_email'),
            'connection_type': findColumnIndex('connection_type'),
            'status': findColumnIndex('status'),
            'requested_at': findColumnIndex('requested_at'),
            'admin_approved': findColumnIndex('admin_approved'),
            'draft_message': findColumnIndex('draft_message'),
            'draft_generated_at': findColumnIndex('draft_generated_at'),
            'client_approved': findColumnIndex('client_approved'),
            'client_approved_at': findColumnIndex('client_approved_at'),
            'admin_final_approved': findColumnIndex('admin_final_approved'),
            'draft_locked': findColumnIndex('draft_locked'),
            'client_goals': findColumnIndex('client_goals'),
            'related_signal_id': findColumnIndex('related_signal_id'),
        };

        // Log found columns for debugging
        console.log('📋 Connections sheet headers:', headers);
        console.log('🗺️ Column mapping:', Object.entries(columnMap)
            .filter(([_, index]) => index !== -1)
            .map(([field, index]) => `${field} → Column ${String.fromCharCode(65 + index)} (${index})`)
            .join(', '));

        // Find the last row with data
        const dataResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEETS.CONNECTIONS}!A:AZ`,
        });
        const allRows = dataResponse.data.values || [];
        const nextRowNumber = allRows.length + 1; // +1 because we're adding after existing rows

        // Helper to convert column index to letter
        const getColumnLetter = (index) => {
            let result = '';
            while (index >= 0) {
                result = String.fromCharCode(65 + (index % 26)) + result;
                index = Math.floor(index / 26) - 1;
            }
            return result;
        };

        // Prepare batch update with only columns that exist in the sheet
        const updates = [];
        for (const [field, columnIndex] of Object.entries(columnMap)) {
            if (columnIndex !== -1 && connectionData[field] !== undefined) {
                const columnLetter = getColumnLetter(columnIndex);
                const value = connectionData[field];
                
                // Convert boolean to string for Google Sheets
                const sheetValue = typeof value === 'boolean' ? value.toString() : (value || '');
                
                updates.push({
                    range: `${SHEETS.CONNECTIONS}!${columnLetter}${nextRowNumber}`,
                    values: [[sheetValue]],
                });
            }
        }

        if (updates.length === 0) {
            throw new Error('No matching columns found in Connections sheet. Please check the header row.');
        }

        // Batch update all columns at once
        await sheets.spreadsheets.values.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                valueInputOption: 'USER_ENTERED',
                data: updates,
            },
        });

        console.log(`✅ Successfully appended connection to Connections sheet at row ${nextRowNumber}`);
        console.log(`   connection_id: ${connectionData.connection_id}`);
        console.log(`   Updated ${updates.length} columns`);

        return { success: true, rowNumber: nextRowNumber };
    } catch (error) {
        console.error('❌ Error appending connection to sheet:', error);
        throw error;
    }
}

