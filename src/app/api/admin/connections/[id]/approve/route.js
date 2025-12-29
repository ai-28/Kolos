import { NextResponse } from "next/server";
import { findConnectionById, updateConnection } from "@/app/lib/googleSheets";
import { requireAuth } from "@/app/lib/session";
import { normalizeRole } from "@/app/lib/roleUtils";
import { connectionEventEmitter } from "@/app/lib/connectionEventEmitter";

/**
 * PATCH /api/admin/connections/[id]/approve
 * Admin approves a connection request
 */
export async function PATCH(request, { params }) {
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

        // Check current status
        const currentStatus = connection.status || connection['status'] || connection['Status'] || 'pending';
        if (currentStatus !== 'pending') {
            return NextResponse.json(
                { error: `Connection is already ${currentStatus}. Cannot approve.` },
                { status: 400 }
            );
        }

        // Update connection
        const updatedConnection = await updateConnection(connectionId, {
            admin_approved: true,
            status: 'admin_approved'
        });

        // Emit SSE event to notify client
        const fromUserId = connection.from_user_id || connection['from_user_id'] || connection['From User ID'];
        connectionEventEmitter.emit(
            connectionId,
            'admin_approved',
            updatedConnection,
            session.clientId,
            fromUserId // Notify the client who made the request
        );

        return NextResponse.json({
            success: true,
            message: "Connection request approved by admin",
            connection_id: connectionId,
        });
    } catch (error) {
        if (error.message === 'Unauthorized') {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }
        console.error("Error approving connection:", error);
        return NextResponse.json(
            { error: "Failed to approve connection", details: error.message },
            { status: 500 }
        );
    }
}

