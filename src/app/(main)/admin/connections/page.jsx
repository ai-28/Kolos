"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Loader2, ArrowLeft, Check, X, FileText, Lock } from "lucide-react";
import { toast } from "sonner";

export default function AdminConnectionsPage() {
  const router = useRouter();
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    fetchConnections();
  }, [filterStatus]);

  const fetchConnections = async () => {
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
  };

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
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <span className="font-medium text-blue-900">Draft Message:</span>
                          {draftLocked && (
                            <Lock className="w-4 h-4 text-green-600" title="Draft Locked" />
                          )}
                        </div>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">
                          {conn.draft_message}
                        </p>
                        {conn.draft_generated_at && (
                          <p className="text-xs text-gray-500 mt-2">
                            Generated: {new Date(conn.draft_generated_at).toLocaleString()}
                          </p>
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
                      {(conn.to_user_linkedin || conn.to_user_email) && (
                        <div className="ml-auto flex gap-2">
                          {conn.to_user_linkedin && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(conn.to_user_linkedin, "_blank")}
                            >
                              LinkedIn
                            </Button>
                          )}
                          {conn.to_user_email && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.location.href = `mailto:${conn.to_user_email}`}
                            >
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
      </main>
    </div>
  );
}

