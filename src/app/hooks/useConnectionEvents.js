"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Custom hook for real-time connection updates via Server-Sent Events
 * @param {Function} onUpdate - Callback function called when connection is updated
 * @param {Function} onError - Optional error handler
 */
export function useConnectionEvents(onUpdate, onError = null) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const eventSourceRef = useRef(null);
  const router = useRouter();
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds

  useEffect(() => {
    let mounted = true;

    const connect = () => {
      try {
        // Close existing connection if any
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        // Create new EventSource connection
        const eventSource = new EventSource('/api/connections/events');
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          if (mounted) {
            setIsConnected(true);
            setError(null);
            reconnectAttemptsRef.current = 0;
            console.log('✅ SSE connection established');
          }
        };

        eventSource.onmessage = (event) => {
          if (mounted) {
            try {
              const data = JSON.parse(event.data);

              // Handle keepalive messages
              if (data.type === 'keepalive') {
                return;
              }

              // Handle connection confirmation
              if (data.type === 'connected') {
                console.log('✅ SSE connected:', data);
                return;
              }

              // Handle connection updates
              if (data.type && data.connection_id && onUpdate) {
                console.log('📨 Connection update received:', data);
                onUpdate(data);
              }
            } catch (parseError) {
              console.error('Error parsing SSE message:', parseError);
            }
          }
        };

        eventSource.onerror = (error) => {
          if (mounted) {
            setIsConnected(false);
            console.error('❌ SSE connection error:', error);

            // Close the connection
            if (eventSourceRef.current) {
              eventSourceRef.current.close();
              eventSourceRef.current = null;
            }

            // Attempt to reconnect
            if (reconnectAttemptsRef.current < maxReconnectAttempts) {
              reconnectAttemptsRef.current += 1;
              console.log(`🔄 Attempting to reconnect (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);

              reconnectTimeoutRef.current = setTimeout(() => {
                if (mounted) {
                  connect();
                }
              }, reconnectDelay);
            } else {
              // Max reconnection attempts reached
              const errorMsg = 'Failed to maintain connection. Please refresh the page.';
              setError(errorMsg);
              if (onError) {
                onError(new Error(errorMsg));
              }
            }
          }
        };
      } catch (error) {
        if (mounted) {
          setIsConnected(false);
          setError(error.message);
          if (onError) {
            onError(error);
          }
        }
      }
    };

    // Initial connection
    connect();

    // Cleanup on unmount
    return () => {
      mounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [onUpdate, onError, router]);

  return { isConnected, error };
}

