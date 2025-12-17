import { NextResponse } from "next/server";
import { getSession } from "@/app/lib/session";

export async function GET() {
    try {
        const session = await getSession();
        
        if (!session) {
            return NextResponse.json(
                { error: "Not authenticated" },
                { status: 401 }
            );
        }

        return NextResponse.json({
            email: session.email,
            clientId: session.clientId,
            role: session.role,
        });
    } catch (error) {
        console.error("Error getting session:", error);
        return NextResponse.json(
            { error: "Failed to get session", details: error.message },
            { status: 500 }
        );
    }
}

