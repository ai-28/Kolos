import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/session";
import { normalizeRole } from "@/app/lib/roleUtils";
import { connectionEventEmitter } from "@/app/lib/connectionEventEmitter";

/**
 * GET /api/connections/events
 * Server-Sent Events endpoint for real-time connection updates
 */
export async function GET(request) {
  try {
    const session = await requireAuth();
    const userId = session.clientId;
    const userRole = session.role || '';

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const isAdmin = normalizeRole(userRole) === 'Admin';

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        const encoder = new TextEncoder();
        const sendEvent = (data) => {
          const message = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        // Send keepalive every 30 seconds
        const keepAliveInterval = setInterval(() => {
          try {
            sendEvent({ type: 'keepalive', timestamp: new Date().toISOString() });
          } catch (error) {
            console.error('Error sending keepalive:', error);
            clearInterval(keepAliveInterval);
          }
        }, 30000);

        // Subscribe to connection events
        const handleEvent = (event) => {
          try {
            // Filter events based on user role and connection ownership
            const connection = event.connection;
            if (!connection) {
              console.warn('Event received without connection data:', event);
              return;
            }

            const fromUserId = connection.from_user_id || connection['from_user_id'] || connection['From User ID'] || '';
            const toUserId = connection.to_user_id || connection['to_user_id'] || connection['To User ID'] || '';

            // Admin sees all events
            // Clients only see events for their own connections (where they are the requester)
            const shouldReceiveEvent = isAdmin || (fromUserId && String(fromUserId).trim() === String(userId).trim());

            console.log(`🔍 Event filter check:`, {
              eventType: event.type,
              connectionId: event.connection_id,
              userId,
              isAdmin,
              fromUserId,
              toUserId,
              shouldReceiveEvent,
              connectionKeys: Object.keys(connection)
            });

            if (shouldReceiveEvent) {
              console.log(`📤 Sending SSE event to ${isAdmin ? 'admin' : 'client'} ${userId}:`, event.type, `(connection: ${event.connection_id})`);
              sendEvent(event);
            } else {
              console.log(`⏭️ Filtered out event for user ${userId} (not admin and not owner). fromUserId: ${fromUserId}, userId: ${userId}`);
            }
          } catch (error) {
            console.error('Error processing connection event:', error);
          }
        };

        // Subscribe to events
        const unsubscribe = connectionEventEmitter.subscribe(userId, handleEvent);

        // Send initial connection confirmation
        sendEvent({
          type: 'connected',
          user_id: userId,
          is_admin: isAdmin,
          timestamp: new Date().toISOString(),
        });

        // Handle client disconnect
        request.signal.addEventListener('abort', () => {
          clearInterval(keepAliveInterval);
          unsubscribe();
          controller.close();
        });
      },
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable buffering for nginx
      },
    });
  } catch (error) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    console.error("Error setting up SSE connection:", error);
    return NextResponse.json(
      { error: "Failed to establish SSE connection", details: error.message },
      { status: 500 }
    );
  }
}

