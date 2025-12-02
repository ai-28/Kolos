"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Loader2, X, AlertCircle } from "lucide-react";

export default function EmailModal({ isOpen, onClose, onSuccess }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError("Please enter an email address");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/clients/search?email=${encodeURIComponent(email.trim())}`);
      const data = await response.json();

      if (!response.ok || !data.found) {
        setError(data.error || "No profile found with this email. Please try again.");
        setLoading(false);
        return;
      }

      // Success - call onSuccess with the client data
      console.log("✅ Client found:", data.client);
      console.log("Client ID:", data.client.id);
      console.log("All client fields:", Object.keys(data.client));
      onSuccess(data.client);
      onClose();
    } catch (err) {
      console.error("Error searching for client:", err);
      setError("Failed to search. Please try again.");
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail("");
    setError(null);
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-3 md:p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 sm:pb-4 p-3 sm:p-4 md:p-6">
          <CardTitle className="text-lg sm:text-xl md:text-2xl">Enter Your Email</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 sm:h-10 sm:w-10 p-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close modal"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                placeholder="your.email@example.com"
                className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm sm:text-base min-h-[44px]"
                disabled={loading}
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-red-600 text-xs sm:text-sm bg-red-50 p-2.5 sm:p-3 rounded-md">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span className="flex-1">{error}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1 min-h-[44px] text-sm sm:text-base"
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 min-h-[44px] text-sm sm:text-base"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span className="hidden sm:inline">Searching...</span>
                    <span className="sm:hidden">Search...</span>
                  </>
                ) : (
                  "Continue"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

