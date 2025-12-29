import { NextResponse } from "next/server";
import { findConnectionById, updateConnection, findRowById, SHEETS } from "@/app/lib/googleSheets";
import { requireAuth } from "@/app/lib/session";
import { normalizeRole } from "@/app/lib/roleUtils";
import { generateConnectionDraft } from "@/app/lib/aiDraftGenerator";
import { connectionEventEmitter } from "@/app/lib/connectionEventEmitter";
import { formatConnection } from "@/app/lib/formatConnection";

/**
 * POST /api/admin/connections/[id]/generate-draft
 * Admin generates AI draft message for connection
 */
export async function POST(request, { params }) {
    try {
        const session = await requireAuth();
        const userRole = session.role || '';

        // Check if user is admin
        const normalizedRole = normalizeRole(userRole);
        if (normalizedRole !== 'Admin') {
            return NextResponse.json(
                { error: "Forbidden: Admin access required" },
                { status: 403 }
            );
        }

        const { id } = await params;
        const connectionId = id;

        // Find connection
        const connection = await findConnectionById(connectionId);
        if (!connection) {
            return NextResponse.json(
                { error: "Connection not found" },
                { status: 404 }
            );
        }

        // Helper function to convert Google Sheets boolean values to actual booleans
        const toBoolean = (value) => {
            if (value === true || value === false) return value;
            if (typeof value === 'string') {
                const lower = value.toLowerCase().trim();
                return lower === 'true' || lower === '1' || lower === 'yes';
            }
            return false;
        };

        // Check if admin has approved - properly convert boolean value
        const rawAdminApproved = connection.admin_approved || connection['admin_approved'] || connection['Admin Approved'] || false;
        const adminApproved = toBoolean(rawAdminApproved);
        if (!adminApproved) {
            return NextResponse.json(
                { error: "Connection must be approved by admin before generating draft" },
                { status: 400 }
            );
        }

        // Check if draft already exists
        const existingDraft = connection.draft_message || connection['draft_message'] || connection['Draft Message'] || '';
        if (existingDraft) {
            return NextResponse.json(
                { error: "Draft already exists. Use update endpoint to modify." },
                { status: 400 }
            );
        }

        // Get client profile
        const fromUserId = connection.from_user_id || connection['from_user_id'] || connection['From User ID'];
        const clientProfile = await findRowById(SHEETS.PROFILES, fromUserId);
        if (!clientProfile) {
            return NextResponse.json(
                { error: "Client profile not found" },
                { status: 404 }
            );
        }

        // Get deal info if it's a deal connection
        let dealInfo = null;
        const dealId = connection.deal_id || connection['deal_id'] || connection['Deal ID'];
        if (dealId) {
            const { findRowsByProfileId } = await import("@/app/lib/googleSheets");
            const deals = await findRowsByProfileId(SHEETS.DEALS, fromUserId);
            dealInfo = deals.find(d => {
                const dId = d.deal_id || d['deal_id'] || d.id || d['id'];
                return dId && String(dId).trim() === String(dealId).trim();
            });
        }

        // Get signal info if related_signal_id exists
        let signalInfo = null;
        const relatedSignalId = connection.related_signal_id || connection['related_signal_id'] || connection['Related Signal ID'];
        if (relatedSignalId) {
            const { findRowsByProfileId } = await import("@/app/lib/googleSheets");
            const signals = await findRowsByProfileId(SHEETS.SIGNALS, fromUserId);
            signalInfo = signals.find(s => {
                // Match by signal identifier (you may need to adjust this based on your signal structure)
                return s && (s.id === relatedSignalId || s.signal_id === relatedSignalId);
            });
        }

        // Get connection details
        const connectionType = connection.connection_type || connection['connection_type'] || connection['Connection Type'] || 'email';
        const targetName = connection.to_user_name || connection['to_user_name'] || connection['To User Name'] || '';
        const targetCompany = dealInfo ? (dealInfo.target || dealInfo['target'] || '') : '';
        const clientGoals = connection.client_goals || connection['client_goals'] || connection['Client Goals'] || '';

        // Generate draft using AI
        const draftMessage = await generateConnectionDraft({
            clientProfile,
            clientGoals,
            signalInfo,
            dealInfo,
            connectionType,
            targetName,
            targetCompany
        });

        // Update connection with draft
        await updateConnection(connectionId, {
            draft_message: draftMessage,
            draft_generated_at: new Date().toISOString(),
            status: 'draft_generated'
        });

        // Fetch and format updated connection with all fields
        const rawUpdatedConnection = await findConnectionById(connectionId);
        const formattedConnection = rawUpdatedConnection ? formatConnection(rawUpdatedConnection) : null;

        // Emit SSE event to notify client and admin
        if (formattedConnection) {
            console.log('📤 Emitting draft_generated event:', connectionId);
            connectionEventEmitter.emit(
                connectionId,
                'draft_generated',
                formattedConnection,
                session.clientId,
                fromUserId // Notify the client who made the request
            );
        }

        return NextResponse.json({
            success: true,
            message: "Draft generated successfully",
            connection_id: connectionId,
            draft_message: draftMessage,
        });
    } catch (error) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        console.error("Error generating draft:", error);
        console.error("Error stack:", error.stack);
        return NextResponse.json(
            { 
                error: "Failed to generate draft", 
                details: error.message,
                ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
            },
            { status: 500 }
        );
    }
}

