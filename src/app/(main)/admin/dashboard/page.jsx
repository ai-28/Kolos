"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent } from "@/app/components/ui/card";
import { Loader2, ArrowLeft, User } from "lucide-react";
import { normalizeRole } from "@/app/lib/roleUtils";

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch("/api/airtable/clients");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch clients");
      }

      setClients(data.clients || []);
    } catch (err) {
      console.error("Error fetching clients:", err);
      setError(err.message || "Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  const handleClientClick = (client) => {
    // Navigate to client dashboard with client ID
    router.push(`/admin/clients?id=${client.id}`);
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
                onClick={() => router.push("/")}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">Client Dashboard</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {clients.length} {clients.length === 1 ? "client" : "clients"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-gray-500">Loading clients...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
              <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Clients</h3>
              <p className="text-red-700 mb-4">{error}</p>
              <Button onClick={fetchClients} className="bg-red-600 hover:bg-red-700">
                Try Again
              </Button>
            </div>
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <User className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Clients Yet</h3>
            <p className="text-gray-500 mb-6">Start onboarding to see clients here.</p>
            <Button onClick={() => router.push("/")} className="bg-primary hover:bg-primary/90">
              Start Onboarding
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {clients.map((client) => {
              // Get display name (check lowercase first, then uppercase)
              const displayName = 
                client.name ||
                client["name"] ||
                client["Full Name"] || 
                client["Name"] || 
                client["First Name"] || 
                "Unknown Client";
              
              // Get company if available (check lowercase first)
              const company = 
                client.company ||
                client["company"] ||
                client["Company"] || 
                client["Company Name"] || 
                "";

              // Get and normalize role
              const clientRole = client.role || client["role"] || client.Role || client["Role"] || "";
              const normalizedRole = normalizeRole(clientRole);

              return (
                <Card
                  key={client.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleClientClick(client)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate mb-1">
                          {displayName}
                        </h3>
                        {company && (
                          <p className="text-sm text-gray-500 truncate mb-1">
                            {company}
                          </p>
                        )}
                        {normalizedRole && (
                          <p className="text-xs text-primary font-medium mb-2">
                            {normalizedRole}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          Click to view details
                        </p>
                      </div>
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
