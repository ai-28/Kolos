"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Loader2, ArrowLeft, Check, X, FileText, Lock, Linkedin, Mail, Edit2, Save, Copy, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useConnectionEvents } from "@/app/hooks/useConnectionEvents";

export default function AdminConnectionsPage() {
  const router = useRouter();
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [showLinkedInModal, setShowLinkedInModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [dealData, setDealData] = useState(null);
  const [loadingDeal, setLoadingDeal] = useState(false);
  const [editingDraft, setEditingDraft] = useState(null);
  const [draftEditText, setDraftEditText] = useState("");
  const [copiedConnectionId, setCopiedConnectionId] = useState(null);
  const [expandedDrafts, setExpandedDrafts] = useState(new Set());

  useEffect(() => {
    fetchConnections();
  }, [filterStatus]);

  // Handle real-time connection updates via SSE
  const handleConnectionUpdate = useCallback((event) => {
    console.log('📨 Admin received connection update:', event);
    
    // Refresh connections list when any update occurs
    fetchConnections();
    
    // Show toast notification based on event type
    switch (event.type) {
      case 'connection_created':
        toast.success('New connection request received');
        break;
      case 'admin_approved':
        toast.success('Connection approved');
        break;
      case 'draft_generated':
        toast.success('Draft generated');
        break;
      case 'draft_updated':
        toast.info('Draft updated');
        break;
      case 'client_approved':
        toast.success('Client approved draft');
        break;
      case 'final_approved':
        toast.success('Connection finalized');
        break;
      default:
        break;
    }
  }, [fetchConnections]);

  // Connect to SSE for real-time updates
  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true);
      const url = filterStatus !== "all" 
        ? `/api/admin/connections?status=${filterStatus}`
        : `/api/admin/connections`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch connections");
      }

      setConnections(data.connections || []);
    } catch (error) {
      console.error("Error fetching connections:", error);
      toast.error(error.message || "Failed to load connections");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  const { isConnected, error: sseError } = useConnectionEvents(handleConnectionUpdate);

  const handleApprove = async (connectionId) => {
    setProcessing(connectionId);
    try {
      const response = await fetch(`/api/admin/connections/${connectionId}/approve`, {
        method: "PATCH",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to approve connection");
      }

      toast.success("Connection approved successfully");
      fetchConnections();
    } catch (error) {
      console.error("Error approving connection:", error);
      toast.error(error.message || "Failed to approve connection");
    } finally {
      setProcessing(null);
    }
  };

  const handleGenerateDraft = async (connectionId) => {
    setProcessing(connectionId);
    try {
      const response = await fetch(`/api/admin/connections/${connectionId}/generate-draft`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.details 
          ? `${data.error}: ${data.details}` 
          : data.error || "Failed to generate draft";
        throw new Error(errorMsg);
      }

      toast.success("Draft generated successfully");
      fetchConnections();
    } catch (error) {
      console.error("Error generating draft:", error);
      toast.error(error.message || "Failed to generate draft");
    } finally {
      setProcessing(null);
    }
  };

  const handleFinalApprove = async (connectionId) => {
    setProcessing(connectionId);
    try {
      const response = await fetch(`/api/admin/connections/${connectionId}/final-approve`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to final approve");
      }

      toast.success("Connection finalized and draft locked");
      fetchConnections();
    } catch (error) {
      console.error("Error final approving:", error);
      toast.error(error.message || "Failed to final approve");
    } finally {
      setProcessing(null);
    }
  };

  const getStatusBadge = (status, adminApproved, clientApproved, draftLocked) => {
    if (draftLocked) {
      return <Badge className="bg-green-600">Approved & Locked</Badge>;
    }
    if (clientApproved) {
      return <Badge className="bg-blue-600">Client Approved</Badge>;
    }
    if (adminApproved) {
      return <Badge className="bg-yellow-600">Draft Ready</Badge>;
    }
    return <Badge className="bg-gray-600">Pending</Badge>;
  };

  const handleLinkedInClick = async (conn) => {
    setSelectedConnection(conn);
    
    // If it's a deal connection, fetch deal data
    if (conn.deal_id) {
      setLoadingDeal(true);
      try {
        const response = await fetch(`/api/deals?profile_id=${conn.from_user_id}`);
        const data = await response.json();
        
        if (response.ok && data.deals) {
          const deal = data.deals.find(d => {
            const dId = d.deal_id || d['deal_id'] || d.id || d['id'];
            return dId && String(dId).trim() === String(conn.deal_id).trim();
          });
          setDealData(deal || null);
        }
      } catch (error) {
        console.error("Error fetching deal:", error);
        toast.error("Failed to load deal information");
      } finally {
        setLoadingDeal(false);
      }
    }
    
    setShowLinkedInModal(true);
  };

  const handleEmailClick = async (conn) => {
    setSelectedConnection(conn);
    
    // If it's a deal connection, fetch deal data
    if (conn.deal_id) {
      setLoadingDeal(true);
      try {
        const response = await fetch(`/api/deals?profile_id=${conn.from_user_id}`);
        const data = await response.json();
        
        if (response.ok && data.deals) {
          const deal = data.deals.find(d => {
            const dId = d.deal_id || d['deal_id'] || d.id || d['id'];
            return dId && String(dId).trim() === String(conn.deal_id).trim();
          });
          setDealData(deal || null);
        }
      } catch (error) {
        console.error("Error fetching deal:", error);
        toast.error("Failed to load deal information");
      } finally {
        setLoadingDeal(false);
      }
    }
    
    setShowEmailModal(true);
  };

  const handleEditDraft = (conn) => {
    setEditingDraft(conn.connection_id);
    setDraftEditText(conn.draft_message || '');
  };

  const handleCancelEdit = () => {
    setEditingDraft(null);
    setDraftEditText("");
  };

  const handleCopyDraft = async (draftText, connectionId) => {
    try {
      await navigator.clipboard.writeText(draftText);
      setCopiedConnectionId(connectionId);
      toast.success("Draft message copied to clipboard!");
      setTimeout(() => {
        setCopiedConnectionId(null);
      }, 2000);
    } catch (error) {
      console.error("Error copying text:", error);
      toast.error("Failed to copy text");
    }
  };

  const handleSaveDraft = async (connectionId) => {
    setProcessing(connectionId);
    try {
      const response = await fetch(`/api/connections/${connectionId}/draft`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          draft_message: draftEditText,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update draft");
      }

      toast.success("Draft updated successfully");
      setEditingDraft(null);
      setDraftEditText("");
      fetchConnections();
    } catch (error) {
      console.error("Error updating draft:", error);
      toast.error(error.message || "Failed to update draft");
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/admin/dashboard")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">Connection Requests</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Filters */}
        <div className="mb-6 flex gap-2">
          <Button
            variant={filterStatus === "all" ? "default" : "outline"}
            onClick={() => setFilterStatus("all")}
            size="sm"
          >
            All
          </Button>
          <Button
            variant={filterStatus === "pending" ? "default" : "outline"}
            onClick={() => setFilterStatus("pending")}
            size="sm"
          >
            Pending
          </Button>
          <Button
            variant={filterStatus === "admin_approved" ? "default" : "outline"}
            onClick={() => setFilterStatus("admin_approved")}
            size="sm"
          >
            Draft Ready
          </Button>
          <Button
            variant={filterStatus === "client_approved" ? "default" : "outline"}
            onClick={() => setFilterStatus("client_approved")}
            size="sm"
          >
            Client Approved
          </Button>
          <Button
            variant={filterStatus === "approved" ? "default" : "outline"}
            onClick={() => setFilterStatus("approved")}
            size="sm"
          >
            Finalized
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-gray-500">Loading connections...</p>
            </div>
          </div>
        ) : connections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-gray-500">No connections found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {connections.map((conn) => {
              const isProcessing = processing === conn.connection_id;
              const adminApproved = conn.admin_approved || false;
              const clientApproved = conn.client_approved || false;
              const draftLocked = conn.draft_locked || false;
              const hasDraft = conn.draft_message && conn.draft_message.trim() !== "";
              const isDealConnection = !!conn.deal_id;

              return (
                <Card key={conn.connection_id} className="bg-white">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {conn.from_user_name || "Unknown User"}
                          </h3>
                          {getStatusBadge(
                            conn.status,
                            adminApproved,
                            clientApproved,
                            draftLocked
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-1">
                          <span className="font-medium">To:</span>{" "}
                          {conn.to_user_name || "Unknown"}
                          {isDealConnection && (
                            <span className="text-gray-500"> (Deal Connection)</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          Requested: {new Date(conn.requested_at).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Draft Message */}
                    {hasDraft && (
                      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="font-medium text-blue-900">Draft Message:</span>
                            {draftLocked && (
                              <Lock className="w-4 h-4 text-green-600" title="Draft Locked" />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {!draftLocked && editingDraft !== conn.connection_id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditDraft(conn)}
                                className="h-7 px-2 text-xs"
                              >
                                <Edit2 className="w-3 h-3 mr-1" />
                                Edit
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newExpanded = new Set(expandedDrafts);
                                if (newExpanded.has(conn.connection_id)) {
                                  newExpanded.delete(conn.connection_id);
                                } else {
                                  newExpanded.add(conn.connection_id);
                                }
                                setExpandedDrafts(newExpanded);
                              }}
                              className="h-7 px-2 text-xs"
                              title={expandedDrafts.has(conn.connection_id) ? "Collapse" : "Expand"}
                            >
                              {expandedDrafts.has(conn.connection_id) ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                        {editingDraft === conn.connection_id ? (
                          <div className="space-y-2">
                            <textarea
                              value={draftEditText}
                              onChange={(e) => setDraftEditText(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm min-h-[120px]"
                              placeholder="Enter draft message..."
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveDraft(conn.connection_id)}
                                disabled={processing === conn.connection_id}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                {processing === conn.connection_id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <Save className="w-4 h-4 mr-1" />
                                    Save
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                                disabled={processing === conn.connection_id}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {expandedDrafts.has(conn.connection_id) ? (
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm text-gray-800 whitespace-pre-wrap flex-1">
                                  {conn.draft_message}
                                </p>
                                {draftLocked && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCopyDraft(conn.draft_message, conn.connection_id)}
                                    className="h-7 px-2 text-xs flex-shrink-0"
                                    title="Copy draft message"
                                  >
                                    {copiedConnectionId === conn.connection_id ? (
                                      <>
                                        <CheckCircle className="w-3 h-3 mr-1 text-green-600" />
                                        Copied
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3 mr-1" />
                                        Copy
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm text-gray-800 whitespace-pre-wrap flex-1 line-clamp-3">
                                  {conn.draft_message}
                                </p>
                                {draftLocked && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleCopyDraft(conn.draft_message, conn.connection_id)}
                                    className="h-7 px-2 text-xs flex-shrink-0"
                                    title="Copy draft message"
                                  >
                                    {copiedConnectionId === conn.connection_id ? (
                                      <>
                                        <CheckCircle className="w-3 h-3 mr-1 text-green-600" />
                                        Copied
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3 mr-1" />
                                        Copy
                                      </>
                                    )}
                                  </Button>
                                )}
                              </div>
                            )}
                            {conn.draft_generated_at && (
                              <p className="text-xs text-gray-500 mt-2">
                                Generated: {new Date(conn.draft_generated_at).toLocaleString()}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {/* Client Approval Status */}
                    {clientApproved && conn.client_approved_at && (
                      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800">
                          ✓ Client approved on {new Date(conn.client_approved_at).toLocaleString()}
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 flex-wrap">
                      {!adminApproved && (
                        <Button
                          onClick={() => handleApprove(conn.connection_id)}
                          disabled={isProcessing}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-2" />
                              Approve
                            </>
                          )}
                        </Button>
                      )}

                      {adminApproved && !hasDraft && (
                        <Button
                          onClick={() => handleGenerateDraft(conn.connection_id)}
                          disabled={isProcessing}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <FileText className="w-4 h-4 mr-2" />
                              Generate Draft
                            </>
                          )}
                        </Button>
                      )}

                      {clientApproved && !draftLocked && (
                        <Button
                          onClick={() => handleFinalApprove(conn.connection_id)}
                          disabled={isProcessing}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Lock className="w-4 h-4 mr-2" />
                              Final Approve & Lock
                            </>
                          )}
                        </Button>
                      )}

                      {/* Contact Info */}
                      {(conn.to_user_linkedin || conn.to_user_email || isDealConnection) && (
                        <div className="ml-auto flex gap-2">
                          {(conn.to_user_linkedin || isDealConnection) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleLinkedInClick(conn)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Linkedin className="w-4 h-4 mr-1" />
                              LinkedIn
                            </Button>
                          )}
                          {(conn.to_user_email || isDealConnection) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEmailClick(conn)}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <Mail className="w-4 h-4 mr-1" />
                              Email
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* LinkedIn Modal */}
        {showLinkedInModal && selectedConnection && (
          <div className="fixed inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
            <Card className="w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900">
                    Decision Makers - LinkedIn
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowLinkedInModal(false);
                      setSelectedConnection(null);
                      setDealData(null);
                    }}
                    className="min-w-[44px] min-h-[44px]"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                {loadingDeal ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      // For deal connections, show all decision makers
                      if (selectedConnection.deal_id && dealData) {
                        try {
                          const allDecisionMakers = dealData.all_decision_makers 
                            ? (typeof dealData.all_decision_makers === 'string' 
                                ? JSON.parse(dealData.all_decision_makers) 
                                : dealData.all_decision_makers)
                            : [];
                          
                          if (!Array.isArray(allDecisionMakers) || allDecisionMakers.length === 0) {
                            // Fallback to primary decision maker
                            const primaryLinkedIn = dealData.decision_maker_linkedin_url || dealData['decision_maker_linkedin_url'] || '';
                            if (primaryLinkedIn) {
                              return (
                                <div className="border rounded-lg p-4 bg-white border-gray-200">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                      <h3 className="font-semibold text-gray-900 mb-2">
                                        {dealData.decision_maker_name || dealData['decision_maker_name'] || "Unknown"}
                                      </h3>
                                      {dealData.decision_maker_role && (
                                        <p className="text-sm text-gray-600 mb-2">{dealData.decision_maker_role}</p>
                                      )}
                                      <a
                                        href={primaryLinkedIn}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:text-blue-700 hover:underline text-sm flex items-center gap-1"
                                      >
                                        <Linkedin className="w-4 h-4" />
                                        {primaryLinkedIn}
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div className="text-center py-8 text-gray-500">
                                <p>No LinkedIn URLs found for this deal.</p>
                              </div>
                            );
                          }

                          return allDecisionMakers.map((dm, index) => {
                            const linkedinUrl = dm.linkedin_url || dm["linkedin_url"] || "";
                            
                            if (!linkedinUrl) return null;
                            
                            return (
                              <div
                                key={index}
                                className="border rounded-lg p-4 bg-white border-gray-200"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900 mb-2">
                                      {dm.name || "Unknown"}
                                    </h3>
                                    {dm.role && (
                                      <p className="text-sm text-gray-600 mb-2">{dm.role}</p>
                                    )}
                                    <a
                                      href={linkedinUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-700 hover:underline text-sm flex items-center gap-1"
                                    >
                                      <Linkedin className="w-4 h-4" />
                                      {linkedinUrl}
                                    </a>
                                  </div>
                                </div>
                              </div>
                            );
                          }).filter(Boolean);
                        } catch (error) {
                          console.error("Error parsing decision makers:", error);
                          return (
                            <div className="text-center py-8 text-red-500">
                              <p>Error loading decision makers data.</p>
                            </div>
                          );
                        }
                      } else {
                        // For user-to-user connections, show single LinkedIn
                        const linkedinUrl = selectedConnection.to_user_linkedin || '';
                        if (linkedinUrl) {
                          return (
                            <div className="border rounded-lg p-4 bg-white border-gray-200">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <h3 className="font-semibold text-gray-900 mb-2">
                                    {selectedConnection.to_user_name || "Unknown"}
                                  </h3>
                                  <a
                                    href={linkedinUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-700 hover:underline text-sm flex items-center gap-1"
                                  >
                                    <Linkedin className="w-4 h-4" />
                                    {linkedinUrl}
                                  </a>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="text-center py-8 text-gray-500">
                            <p>No LinkedIn URL available.</p>
                          </div>
                        );
                      }
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Email Modal */}
        {showEmailModal && selectedConnection && (
          <div className="fixed inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
            <Card className="w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-900">
                    Decision Makers - Email
                  </h2>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setShowEmailModal(false);
                      setSelectedConnection(null);
                      setDealData(null);
                    }}
                    className="min-w-[44px] min-h-[44px]"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                {loadingDeal ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      // For deal connections, show all decision makers
                      if (selectedConnection.deal_id && dealData) {
                        try {
                          const allDecisionMakers = dealData.all_decision_makers 
                            ? (typeof dealData.all_decision_makers === 'string' 
                                ? JSON.parse(dealData.all_decision_makers) 
                                : dealData.all_decision_makers)
                            : [];
                          
                          if (!Array.isArray(allDecisionMakers) || allDecisionMakers.length === 0) {
                            // Fallback to primary decision maker
                            const primaryEmail = dealData.decision_maker_email || dealData['decision_maker_email'] || '';
                            if (primaryEmail) {
                              return (
                                <div className="border rounded-lg p-4 bg-white border-gray-200">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                      <h3 className="font-semibold text-gray-900 mb-2">
                                        {dealData.decision_maker_name || dealData['decision_maker_name'] || "Unknown"}
                                      </h3>
                                      {dealData.decision_maker_role && (
                                        <p className="text-sm text-gray-600 mb-2">{dealData.decision_maker_role}</p>
                                      )}
                                      <a
                                        href={`mailto:${primaryEmail}`}
                                        className="text-blue-600 hover:text-blue-700 hover:underline text-sm flex items-center gap-1"
                                      >
                                        <Mail className="w-4 h-4" />
                                        {primaryEmail}
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div className="text-center py-8 text-gray-500">
                                <p>No email addresses found for this deal.</p>
                              </div>
                            );
                          }

                          return allDecisionMakers.map((dm, index) => {
                            const email = dm.email || dm["email"] || "";
                            
                            if (!email) return null;
                            
                            return (
                              <div
                                key={index}
                                className="border rounded-lg p-4 bg-white border-gray-200"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <h3 className="font-semibold text-gray-900 mb-2">
                                      {dm.name || "Unknown"}
                                    </h3>
                                    {dm.role && (
                                      <p className="text-sm text-gray-600 mb-2">{dm.role}</p>
                                    )}
                                    <a
                                      href={`mailto:${email}`}
                                      className="text-blue-600 hover:text-blue-700 hover:underline text-sm flex items-center gap-1"
                                    >
                                      <Mail className="w-4 h-4" />
                                      {email}
                                    </a>
                                  </div>
                                </div>
                              </div>
                            );
                          }).filter(Boolean);
                        } catch (error) {
                          console.error("Error parsing decision makers:", error);
                          return (
                            <div className="text-center py-8 text-red-500">
                              <p>Error loading decision makers data.</p>
                            </div>
                          );
                        }
                      } else {
                        // For user-to-user connections, show single email
                        const email = selectedConnection.to_user_email || '';
                        if (email) {
                          return (
                            <div className="border rounded-lg p-4 bg-white border-gray-200">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1">
                                  <h3 className="font-semibold text-gray-900 mb-2">
                                    {selectedConnection.to_user_name || "Unknown"}
                                  </h3>
                                  <a
                                    href={`mailto:${email}`}
                                    className="text-blue-600 hover:text-blue-700 hover:underline text-sm flex items-center gap-1"
                                  >
                                    <Mail className="w-4 h-4" />
                                    {email}
                                  </a>
                                </div>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="text-center py-8 text-gray-500">
                            <p>No email address available.</p>
                          </div>
                        );
                      }
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

