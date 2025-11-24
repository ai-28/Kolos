"use client";

import { useState, useEffect, useRef } from "react";
import { RetellWebClient } from "retell-client-js-sdk";
import { X, Loader2, Mic, MicOff } from "lucide-react";

export default function VoiceWidget({ isOpen, onClose, autoStart = true }) {
  const [messages, setMessages] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [agentStatus, setAgentStatus] = useState("Initializing...");
  const [currentAgentMessage, setCurrentAgentMessage] = useState("");
  const [currentUserMessage, setCurrentUserMessage] = useState("");
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const messagesEndRef = useRef(null);
  const retellClientRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentAgentMessage]);

  // Initialize Retell client and start conversation when widget opens
  useEffect(() => {
    if (isOpen && autoStart && !isConnected && !isConnecting) {
      startConversation();
    }

    // Cleanup on unmount
    return () => {
      if (retellClientRef.current) {
        retellClientRef.current.stopCall();
      }
    };
  }, [isOpen, autoStart]);

  // Check microphone permissions before starting
  const checkMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop immediately after checking
      return true;
    } catch (error) {
      console.error("Microphone permission error:", error);
      return false;
    }
  };

  const startConversation = async () => {
    setIsConnecting(true);
    setAgentStatus("Checking microphone...");

    // Check microphone permission first
    const hasPermission = await checkMicrophonePermission();
    if (!hasPermission) {
      setIsConnecting(false);
      setAgentStatus("Microphone access denied");
      addMessage("system", "❌ Microphone access denied. Please allow microphone access in your browser settings and refresh the page.");
      setMicPermissionGranted(false);
      return;
    }

    setAgentStatus("Connecting to AI agent...");

    try {
      // Initialize Retell Web Client
      const retellWebClient = new RetellWebClient();
      retellClientRef.current = retellWebClient;

      // Register event handlers
      retellWebClient.on("conversationStarted", () => {
        console.log("Conversation started");
        setIsConnected(true);
        setIsConnecting(false);
        setAgentStatus("Connected");
      });

      retellWebClient.on("audio", (audio) => {
        console.log("Received audio:", audio);
      });

      retellWebClient.on("conversationEnded", ({ code, reason }) => {
        console.log("Conversation ended:", code, reason);
        // Finalize any pending messages
        if (currentAgentMessage) {
          addMessage("assistant", currentAgentMessage);
          setCurrentAgentMessage("");
          setIsAgentSpeaking(false);
        }
        if (currentUserMessage) {
          addMessage("user", currentUserMessage);
          setCurrentUserMessage("");
          setIsUserSpeaking(false);
        }
        setIsConnected(false);
        setAgentStatus("Disconnected");
        
        // Show appropriate message based on reason
        if (code === 1000) {
          // Normal completion - function was triggered and call ended
          addMessage("system", "✅ Conversation completed! Your responses have been saved.");
        } else {
          addMessage("system", `Conversation ended. ${reason ? `Reason: ${reason}` : `Code: ${code}`}`);
        }
      });

      retellWebClient.on("error", (error) => {
        console.error("Retell error:", error);
        setIsConnecting(false);
        setAgentStatus("Connection error");
        
        if (error.name === "NotFoundError" || 
            error.message?.includes("device not found") ||
            error.message?.includes("Requested device not found")) {
          setAgentStatus("Microphone not found");
          setMicPermissionGranted(false);
          addMessage("system", "❌ Microphone not found or access denied. Please check your microphone settings and allow access, then refresh the page.");
        } else {
          setAgentStatus("Error occurred");
          addMessage("system", `Error: ${error.message || "Connection failed"}`);
        }
      });

      retellWebClient.on("update", (update) => {
        console.log("Update received:", update);
        
        // If we're receiving updates, we're connected
        if (!isConnected && isConnecting) {
          setIsConnected(true);
          setIsConnecting(false);
          setAgentStatus("Connected");
          setMicPermissionGranted(true);
        }
        
        // Handle transcript updates - simple approach
        // Last entry = currently streaming (STT in real-time)
        // Previous entries = completed messages
        if (update.transcript && update.transcript.length > 0) {
          const transcript = update.transcript;
          const lastEntry = transcript[transcript.length - 1];
          
          // Last entry is the streaming message (agent or user speaking)
          if (lastEntry.role === "agent" && lastEntry.content) {
            setCurrentAgentMessage(lastEntry.content);
            setIsAgentSpeaking(true);
            setCurrentUserMessage(""); // Clear user message when agent speaks
            setIsUserSpeaking(false);
          } else if (lastEntry.role === "user" && lastEntry.content) {
            setCurrentUserMessage(lastEntry.content);
            setIsUserSpeaking(true);
            setCurrentAgentMessage(""); // Clear agent message when user speaks
            setIsAgentSpeaking(false);
          }
          
          // All entries except the last one are completed messages
          transcript.slice(0, -1).forEach((entry) => {
            if (!entry.content || !entry.content.trim()) return;
            
            // Check if we already have this message (simple duplicate check)
            const exists = messages.some(
              m => m.role === (entry.role === "agent" ? "assistant" : "user") && 
                   m.content === entry.content.trim()
            );
            
            if (!exists) {
              addMessage(entry.role === "agent" ? "assistant" : "user", entry.content);
            }
          });
        }
      });

      // Get access token from your API
      const response = await fetch("/api/retell/get-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error("API Error:", data);
        throw new Error(data.details || data.error || "Failed to get access token");
      }
      
      if (!data.accessToken) {
        throw new Error("No access token received from API");
      }
      
      // Start the conversation with the access token
      // This will request microphone permission
      retellWebClient.startCall({
        accessToken: data.accessToken,
        sampleRate: 24000,
        enableUpdate: true,
      }).then(() => {
        console.log("Call started successfully");
        setMicPermissionGranted(true);
        setIsConnected(true);
        setIsConnecting(false);
        setAgentStatus("Connected");
      }).catch((startError) => {
        console.error("Call start error:", startError);
        setIsConnecting(false);
        setMicPermissionGranted(false);
        
        if (startError.name === "NotFoundError" || 
            startError.message?.includes("device not found") ||
            startError.message?.includes("Requested device not found")) {
          setAgentStatus("Microphone required");
          addMessage("system", "❌ Microphone not found or access denied. Please:");
          addMessage("system", "1. Check if your microphone is connected");
          addMessage("system", "2. Allow microphone access in your browser settings");
          addMessage("system", "3. Refresh the page and try again");
        } else {
          setAgentStatus("Failed to start call");
          addMessage("system", `Failed to start call: ${startError.message || "Unknown error"}`);
        }
      });

    } catch (error) {
      console.error("Failed to start conversation:", error);
      setIsConnecting(false);
      setAgentStatus("Connection failed");
      addMessage("system", error.message || "Failed to connect to AI agent. Please try again.");
    }
  };

  const addMessage = (role, content) => {
    if (!content || !content.trim()) return;
    
    setMessages((prev) => {
      // Check if this exact message already exists (more thorough check)
      const exists = prev.some(
        m => m.role === role && m.content === content.trim()
      );
      
      if (exists) {
        return prev; // Don't add duplicate
      }
      
      // Also check if the last message is the same (common case)
      const lastMessage = prev[prev.length - 1];
      if (lastMessage?.role === role && lastMessage?.content === content.trim()) {
        return prev;
      }
      
      return [...prev, { role, content: content.trim(), timestamp: new Date() }];
    });
  };

  // Finalize streaming messages when they complete
  useEffect(() => {
    if (!isAgentSpeaking && currentAgentMessage) {
      addMessage("assistant", currentAgentMessage);
      setCurrentAgentMessage("");
    }
    if (!isUserSpeaking && currentUserMessage) {
      addMessage("user", currentUserMessage);
      setCurrentUserMessage("");
    }
  }, [isAgentSpeaking, isUserSpeaking, currentAgentMessage, currentUserMessage]);

  const handleClose = () => {
    if (retellClientRef.current) {
      retellClientRef.current.stopCall();
    }
    setMessages([]);
    setCurrentAgentMessage("");
    setCurrentUserMessage("");
    setIsAgentSpeaking(false);
    setIsUserSpeaking(false);
    setIsConnected(false);
    setIsConnecting(false);
    setMicPermissionGranted(false);
    setAgentStatus("Initializing...");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md flex flex-col h-[700px]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <img
              src="https://storage.mlcdn.com/account_image/1108377/l1IcJ0rEULJH2abWtkQaEOpl3jJqZRVMyJloBUMd.jpg"
              alt="Jessica"
              className="w-10 h-10 rounded-full"
            />
            <div>
              <h3 className="font-semibold text-gray-900">Jessica</h3>
              <p className="text-xs text-gray-500">{agentStatus}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {isConnecting && (
            <div className="flex items-center justify-center gap-2 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Connecting to AI agent...</span>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === "user"
                    ? "bg-primary text-white"
                    : message.role === "assistant"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "bg-gray-200 text-gray-600 text-sm italic"
                }`}
              >
                {message.content}
              </div>
            </div>
          ))}
          
          {/* Current streaming agent message */}
          {isAgentSpeaking && currentAgentMessage && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg px-4 py-2 bg-white text-gray-900 shadow-sm">
                {currentAgentMessage}
                <span className="inline-block w-1 h-4 ml-1 bg-gray-900 animate-pulse"></span>
              </div>
            </div>
          )}
          
          {/* Current streaming user message */}
          {isUserSpeaking && currentUserMessage && (
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-lg px-4 py-2 bg-primary text-white">
                {currentUserMessage}
                <span className="inline-block w-1 h-4 ml-1 bg-white animate-pulse"></span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Voice Status */}
        <div className="p-4 border-t bg-white flex-shrink-0">
          <div className="flex items-center justify-center gap-3">
            {isConnected ? (
              <>
                {micPermissionGranted ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <Mic className="w-5 h-5" />
                    <span className="text-sm font-medium">Microphone active - Speak to answer</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-amber-600">
                    <MicOff className="w-5 h-5" />
                    <span className="text-sm">Please allow microphone access</span>
                  </div>
                )}
              </>
            ) : agentStatus.includes("Microphone") || agentStatus.includes("not found") ? (
              <div className="flex flex-col items-center gap-2 text-red-600">
                <MicOff className="w-5 h-5" />
                <span className="text-sm font-medium">{agentStatus}</span>
                <button
                  onClick={() => window.location.reload()}
                  className="text-xs px-3 py-1 bg-primary text-white rounded hover:bg-primary/90 transition-colors"
                >
                  Refresh & Retry
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">{agentStatus}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">
            {isConnected 
              ? "The agent will ask questions. Answer by speaking into your microphone."
              : agentStatus.includes("Microphone") || agentStatus.includes("not found")
              ? "Check browser settings → Privacy → Microphone → Allow access"
              : "Connecting to voice agent..."}
          </p>
        </div>
      </div>
    </div>
  );
}