"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { X, AlertCircle, Loader2 } from "lucide-react";

export default function OnboardingModal({ isOpen, onClose, onStart }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [errors, setErrors] = useState({});
  const [isChecking, setIsChecking] = useState(false);

  const validate = () => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = "Name is required";
    if (!email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }
    if (!linkedinUrl.trim()) newErrors.linkedinUrl = "LinkedIn URL is required";
    else if (!linkedinUrl.includes("linkedin.com")) {
      newErrors.linkedinUrl = "Please enter a valid LinkedIn URL";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkEmailExists = async (emailToCheck) => {
    try {
      const response = await fetch(`/api/clients/search?email=${encodeURIComponent(emailToCheck.trim())}`);
      const data = await response.json();
      
      // If email is found, it means it already exists
      return response.ok && data.found === true;
    } catch (error) {
      console.error("Error checking email:", error);
      // If there's an error, we'll assume email doesn't exist to allow the process to continue
      // You might want to handle this differently based on your needs
      return false;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) {
      return;
    }

    setIsChecking(true);
    setErrors({});

    // Check if email already exists
    const emailExists = await checkEmailExists(email);
    
    if (emailExists) {
      setErrors({ 
        email: "This email already exists in our database. Please use a different email address." 
      });
      setIsChecking(false);
      return;
    }

    // Email doesn't exist, proceed with onboarding
    setIsChecking(false);
    onStart({ name, email, linkedinUrl });
    // Reset form
    setName("");
    setEmail("");
    setLinkedinUrl("");
    setErrors({});
  };

  const handleClose = () => {
    setName("");
    setEmail("");
    setLinkedinUrl("");
    setErrors({});
    setIsChecking(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-3 md:p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 sm:pb-4 p-3 sm:p-4 md:p-6">
          <CardTitle className="text-lg sm:text-xl md:text-2xl">Start AI Onboarding</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 sm:h-10 sm:w-10 p-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close modal"
            disabled={isChecking}
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 md:p-6 pt-0">
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div>
              <label htmlFor="name" className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
                Name *
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors({ ...errors, name: "" });
                }}
                placeholder="Enter your name"
                className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm sm:text-base min-h-[44px]"
                autoFocus
                disabled={isChecking}
              />
              {errors.name && (
                <div className="flex items-start gap-2 text-red-600 text-xs sm:text-sm bg-red-50 p-2 mt-1.5 rounded-md">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span className="flex-1">{errors.name}</span>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
                Email *
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrors({ ...errors, email: "" });
                }}
                placeholder="your.email@example.com"
                className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm sm:text-base min-h-[44px]"
                disabled={isChecking}
              />
              {errors.email && (
                <div className="flex items-start gap-2 text-red-600 text-xs sm:text-sm bg-red-50 p-2 mt-1.5 rounded-md">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span className="flex-1">{errors.email}</span>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="linkedinUrl" className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
                LinkedIn URL *
              </label>
              <input
                id="linkedinUrl"
                type="url"
                value={linkedinUrl}
                onChange={(e) => {
                  setLinkedinUrl(e.target.value);
                  setErrors({ ...errors, linkedinUrl: "" });
                }}
                placeholder="https://linkedin.com/in/yourprofile"
                className="w-full px-3 py-2.5 sm:py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary text-sm sm:text-base min-h-[44px]"
                disabled={isChecking}
              />
              {errors.linkedinUrl && (
                <div className="flex items-start gap-2 text-red-600 text-xs sm:text-sm bg-red-50 p-2 mt-1.5 rounded-md">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span className="flex-1">{errors.linkedinUrl}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1 min-h-[44px] text-sm sm:text-base"
                disabled={isChecking}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 min-h-[44px] text-sm sm:text-base"
                disabled={isChecking}
              >
                {isChecking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  "Start AI Onboarding"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

