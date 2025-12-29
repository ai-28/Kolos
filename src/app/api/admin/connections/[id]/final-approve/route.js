import { NextResponse } from "next/server";
import { findConnectionById, updateConnection } from "@/app/lib/googleSheets";
import { requireAuth } from "@/app/lib/session";
import { normalizeRole } from "@/app/lib/roleUtils";

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

        // Check if client has approved
        const clientApproved = connection.client_approved || connection['client_approved'] || connection['Client Approved'] || false;
        if (!clientApproved) {
            return NextResponse.json(
                { error: "Client must approve draft before final admin approval" },
                { status: 400 }
            );
        }

        // Check if already locked
        const draftLocked = connection.draft_locked || connection['draft_locked'] || connection['Draft Locked'] || false;
        if (draftLocked) {
            return NextResponse.json(
                { error: "Draft is already locked" },
                { status: 400 }
            );
        }

        // Update connection
        await updateConnection(connectionId, {
            admin_final_approved: true,
            draft_locked: true,
            status: 'approved'
        });

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

