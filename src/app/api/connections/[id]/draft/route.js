import { NextResponse } from "next/server";
import { findConnectionById, updateConnection } from "@/app/lib/googleSheets";
import { requireAuth } from "@/app/lib/session";
import { connectionEventEmitter } from "@/app/lib/connectionEventEmitter";
import { formatConnection } from "@/app/lib/formatConnection";

/**
 * PATCH /api/connections/[id]/draft
 * Update draft message (admin or client can edit)
 */
export async function PATCH(request, { params }) {
    try {
        const session = await requireAuth();
        const { id } = await params;
        const connectionId = id;

        // Get updated draft message from request body
        const { draft_message } = await request.json();

        if (!draft_message || typeof draft_message !== 'string') {
            return NextResponse.json(
                { error: "draft_message is required and must be a string" },
                { status: 400 }
            );
        }

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

        // Check if draft is locked - properly convert boolean value
        const rawDraftLocked = connection.draft_locked || connection['draft_locked'] || connection['Draft Locked'] || false;
        const draftLocked = toBoolean(rawDraftLocked);
        if (draftLocked) {
            return NextResponse.json(
                { error: "Draft is locked and cannot be edited" },
                { status: 400 }
            );
        }

        // Check ownership: client can only edit their own connections
        const fromUserId = connection.from_user_id || connection['from_user_id'] || connection['From User ID'];
        const sessionClientId = session.clientId;
        const userRole = session.role || '';

        // Admin can edit any connection, client can only edit their own
        const isAdmin = userRole && userRole.toLowerCase().includes('admin');
        if (!isAdmin && fromUserId !== sessionClientId) {
            return NextResponse.json(
                { error: "Forbidden: You can only edit your own connections" },
                { status: 403 }
            );
        }

        // Update draft message
        await updateConnection(connectionId, {
            draft_message: draft_message.trim(),
        });

        // Fetch and format updated connection with all fields
        const rawUpdatedConnection = await findConnectionById(connectionId);
        const formattedConnection = rawUpdatedConnection ? formatConnection(rawUpdatedConnection) : null;

        // Emit SSE event (reuse isAdmin from above)
        if (formattedConnection) {
            console.log('📤 Emitting draft_updated event:', connectionId);
            connectionEventEmitter.emit(
                connectionId,
                'draft_updated',
                formattedConnection,
                sessionClientId,
                isAdmin ? fromUserId : null // If admin edited, notify client; if client edited, notify admin
            );
        }

        return NextResponse.json({
            success: true,
            message: "Draft updated successfully",
            connection_id: connectionId,
        });
    } catch (error) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        console.error("Error updating draft:", error);
        return NextResponse.json(
            { error: "Failed to update draft", details: error.message },
            { status: 500 }
        );
    }
}

