/**
 * Simple in-memory event emitter for connection updates
 * Used to broadcast connection changes to SSE clients
 */

class ConnectionEventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  /**
   * Subscribe to connection events
   * @param {string} userId - User ID to filter events for
   * @param {Function} callback - Callback function to receive events
   * @returns {Function} Unsubscribe function
   */
  subscribe(userId, callback) {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, new Set());
    }
    this.listeners.get(userId).add(callback);

    // Return unsubscribe function
    return () => {
      const userListeners = this.listeners.get(userId);
      if (userListeners) {
        userListeners.delete(callback);
        if (userListeners.size === 0) {
          this.listeners.delete(userId);
        }
      }
    };
  }

  /**
   * Emit connection update event
   * @param {string} connectionId - Connection ID that was updated
   * @param {string} eventType - Type of event (admin_approved, draft_generated, draft_updated, client_approved, final_approved)
   * @param {Object} connectionData - Updated connection data
   * @param {string} fromUserId - User ID who triggered the event
   * @param {string} targetUserId - Optional: specific user ID to notify (for admin->client notifications)
   */
  emit(connectionId, eventType, connectionData, fromUserId, targetUserId = null) {
    const event = {
      type: eventType,
      connection_id: connectionId,
      connection: connectionData,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to all listeners
    // The SSE endpoint will filter events based on:
    // - Admin role (admins see all events)
    // - Connection ownership (clients see their own connections)
    this.listeners.forEach((listeners, userId) => {
      listeners.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error(`Error notifying listener for user ${userId}:`, error);
        }
      });
    });
  }

  /**
   * Get all active subscribers
   */
  getSubscriberCount() {
    let total = 0;
    this.listeners.forEach((listeners) => {
      total += listeners.size;
    });
    return total;
  }
}

// Export singleton instance
export const connectionEventEmitter = new ConnectionEventEmitter();

