import { NextResponse } from "next/server";
import { findConnectionById, updateConnection } from "@/app/lib/googleSheets";
import { requireAuth } from "@/app/lib/session";
import { connectionEventEmitter } from "@/app/lib/connectionEventEmitter";
import { formatConnection } from "@/app/lib/formatConnection";

/**
 * POST /api/connections/[id]/approve-draft
 * Client approves the draft message
 */
export async function POST(request, { params }) {
    try {
        const session = await requireAuth();
        const userId = session.clientId;

        if (!userId) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
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

        // Check ownership: admin can approve any connection, client can only approve their own
        const fromUserId = connection.from_user_id || connection['from_user_id'] || connection['From User ID'];
        const userRole = session.role || '';

        // Admin can approve any connection, client can only approve their own
        const isAdmin = userRole && userRole.toLowerCase().includes('admin');
        if (!isAdmin && String(fromUserId).trim() !== String(userId).trim()) {
            return NextResponse.json(
                { error: "Forbidden: You can only approve your own connection requests" },
                { status: 403 }
            );
        }

        // Check if draft exists
        const draftMessage = connection.draft_message || connection['draft_message'] || connection['Draft Message'] || '';
        if (!draftMessage) {
            return NextResponse.json(
                { error: "No draft message found. Admin must generate draft first." },
                { status: 400 }
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

        // Check if already approved - properly convert boolean value
        const rawClientApproved = connection.client_approved || connection['client_approved'] || connection['Client Approved'] || false;
        const clientApproved = toBoolean(rawClientApproved);
        if (clientApproved) {
            return NextResponse.json(
                { error: "Draft already approved by client" },
                { status: 400 }
            );
        }

        // Update connection
        await updateConnection(connectionId, {
            client_approved: true,
            client_approved_at: new Date().toISOString(),
            status: 'client_approved'
        });

        // Fetch and format updated connection with all fields
        const rawUpdatedConnection = await findConnectionById(connectionId);
        const formattedConnection = rawUpdatedConnection ? formatConnection(rawUpdatedConnection) : null;

        // Emit SSE event to notify admin
        // Admin will see this event since they subscribe to all connections
        if (formattedConnection) {
            console.log('📤 Emitting client_approved event:', connectionId);
            connectionEventEmitter.emit(
                connectionId,
                'client_approved',
                formattedConnection,
                userId
            );
        }

        return NextResponse.json({
            success: true,
            message: "Draft approved by client",
            connection_id: connectionId,
        });
    } catch (error) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        console.error("Error approving draft:", error);
        return NextResponse.json(
            { error: "Failed to approve draft", details: error.message },
            { status: 500 }
        );
    }
}

