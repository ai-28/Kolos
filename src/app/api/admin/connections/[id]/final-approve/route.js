import { NextResponse } from "next/server";
import { findConnectionById, updateConnection } from "@/app/lib/googleSheets";
import { requireAuth } from "@/app/lib/session";
import { normalizeRole } from "@/app/lib/roleUtils";
import { connectionEventEmitter } from "@/app/lib/connectionEventEmitter";

/**
 * POST /api/admin/connections/[id]/final-approve
 * Admin final approval after client approval (locks draft)
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

        // Check if client has approved - properly convert boolean value
        const rawClientApproved = connection.client_approved || connection['client_approved'] || connection['Client Approved'] || false;
        const clientApproved = toBoolean(rawClientApproved);
        if (!clientApproved) {
            return NextResponse.json(
                { error: "Client must approve draft before final admin approval" },
                { status: 400 }
            );
        }

        // Check if already locked - properly convert boolean value
        const rawDraftLocked = connection.draft_locked || connection['draft_locked'] || connection['Draft Locked'] || false;
        const draftLocked = toBoolean(rawDraftLocked);
        if (draftLocked) {
            return NextResponse.json(
                { error: "Draft is already locked" },
                { status: 400 }
            );
        }

        // Update connection
        const updatedConnection = await updateConnection(connectionId, {
            admin_final_approved: true,
            draft_locked: true,
            status: 'approved'
        });

        // Emit SSE event to notify client
        const fromUserId = connection.from_user_id || connection['from_user_id'] || connection['From User ID'];
        connectionEventEmitter.emit(
            connectionId,
            'final_approved',
            updatedConnection,
            session.clientId,
            fromUserId // Notify the client
        );

        return NextResponse.json({
            success: true,
            message: "Connection approved and draft locked",
            connection_id: connectionId,
        });
    } catch (error) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        console.error("Error final approving connection:", error);
        return NextResponse.json(
            { error: "Failed to final approve connection", details: error.message },
            { status: 500 }
        );
    }
}

