"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/app/components/ui/accordion";
import { CheckCircle2, Menu, X } from "lucide-react";
import VoiceWidget from "@/app/components/VoiceWidget";
import EmailModal from "@/app/components/EmailModal";
import OnboardingModal from "@/app/components/OnboardingModal";

export default function Home() {
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [initialVariables, setInitialVariables] = useState(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();

  const handleStartOnboarding = () => {
    setIsOnboardingModalOpen(true);
  };

  const handleOnboardingStart = (variables) => {
    setInitialVariables(variables);
    setIsOnboardingModalOpen(false);
    setIsWidgetOpen(true);
  };

  const handleGoToDashboard = () => {
    setIsEmailModalOpen(true);
  };

  const handleEmailSuccess = (client) => {
    // Navigate to client dashboard with the found client ID
    console.log("Navigating with client:", client);
    const clientId = client.id || client.ID || client.Id || client.email;
    console.log("Using client ID:", clientId);
    
    if (!clientId) {
      console.error("No ID found in client object:", client);
      return;
    }
    
    router.push(`/client/dashboard?id=${encodeURIComponent(clientId)}`);
  };

  return (
    <>
    <div className="min-h-screen mx-auto w-full overflow-x-hidden">
      {/* Header */}
      <header className="mx-auto xl:max-w-[1100px] lg:max-w-[900px] md:max-w-[700px] sm:max-w-[500px] sm:px-0 px-3 sm:px-4 md:px-6 sticky top-0 z-50 bg-[#ffffff] border-b" style={{ borderColor: '#0D2D25' }}>
        <div className="mx-auto">
          <nav className="py-3 sm:py-4 md:py-6 flex items-center justify-between">
            {/* Logo */}
            <div className="items-center flex-shrink-0">
              <img
                src="https://storage.mlcdn.com/account_image/1108377/l1IcJ0rEULJH2abWtkQaEOpl3jJqZRVMyJloBUMd.jpg"
                alt="Kolos Logo"
                className="w-28 sm:w-32 md:w-40 lg:w-56 h-auto"
              />
            </div>

            {/* Desktop Navigation */}
            <div className="flex-1 hidden lg:flex justify-center gap-8">
              <a href="#" className="text-base hover:opacity-70 transition-opacity min-h-[44px] flex items-center" style={{ color: '#000000' }}>
                Onboarding
              </a>
              <a href="https://kolos.network" target="_blank" rel="noopener noreferrer" className="text-base hover:opacity-70 transition-opacity min-h-[44px] flex items-center" style={{ color: '#000000' }}>
                Kolos Website
              </a>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="lg:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" style={{ color: '#000000' }} />
              ) : (
                <Menu className="w-6 h-6" style={{ color: '#000000' }} />
              )}
            </button>
          </nav>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="lg:hidden border-t py-3 sm:py-4" style={{ borderColor: '#0D2D25' }}>
              <div className="flex flex-col gap-2 sm:gap-3">
                <a 
                  href="#" 
                  className="text-sm sm:text-base hover:opacity-70 transition-opacity px-2 sm:px-3 py-2.5 sm:py-3 min-h-[44px] flex items-center" 
                  style={{ color: '#000000' }}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Onboarding
                </a>
                <a 
                  href="https://kolos.network" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sm sm:text-base hover:opacity-70 transition-opacity px-2 sm:px-3 py-2.5 sm:py-3 min-h-[44px] flex items-center" 
                  style={{ color: '#000000' }}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Kolos Website
                </a>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto xl:max-w-[1100px] lg:max-w-[900px] md:max-w-[700px] sm:max-w-[500px] sm:px-0 px-3 sm:px-4 md:px-6 flex-1" style={{ backgroundColor: '#ffffff' }}>
        <div className="mx-auto">
          <div className="py-8 sm:py-12 md:py-16 lg:py-24 xl:py-32 grid lg:grid-cols-1 gap-6 sm:gap-8 md:gap-12 lg:gap-16">
            <div className="flex flex-col gap-3 sm:gap-4 md:gap-6">
              {/* Main Heading */}
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-[68px] font-semibold leading-tight sm:leading-tight" style={{ color: '#0D2D25' }}>
                Welcome to Kolos AI Onboarding
              </h1>

              {/* Subheading */}
              <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-[48px] font-semibold leading-tight sm:leading-tight" style={{ color: '#0D2D25' }}>
                Unlock the Right Connections. Powered by AI, Tailored to You.
              </h2>

              {/* Description */}
              <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-[22px] text-gray-700 leading-relaxed">
                In just a few minutes, Kolos AI will learn about your goals and match you with high-value opportunities — from strategic intros to expansion partners.
              </p>

              {/* Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2 sm:pt-3 md:pt-4">
                <button
                  className="px-6 hover:cursor-pointer sm:px-8 py-3 sm:py-3.5 rounded-md font-medium text-sm sm:text-base text-white transition-opacity hover:opacity-90 w-full sm:w-auto min-h-[44px] flex items-center justify-center"
                  style={{ backgroundColor: '#0D2D25' }}
                  onClick={handleStartOnboarding}
                >
                  Start AI Onboarding
                </button>
                <button
                  className="px-6 hover:cursor-pointer sm:px-8 py-3 sm:py-3.5 rounded-md font-medium text-sm sm:text-base transition-opacity hover:opacity-90 w-full sm:w-auto min-h-[44px] flex items-center justify-center"
                  style={{
                    backgroundColor: 'transparent',
                    color: '#000000',
                    border: '1px solid #000000'
                  }}
                  onClick={handleGoToDashboard}
                >
                  Go To Dashboard
                </button>
              </div>
            </div>

            {/* Hero Image */}
            <div className="flex justify-center lg:justify-start mt-4 sm:mt-6 md:mt-8 lg:mt-12">
              <div
                className="relative overflow-hidden rounded-lg w-full"
                style={{
                  maxWidth: '100%',
                  aspectRatio: '1/1',
                }}
              >
                <img
                  src="https://ext.same-assets.com/3822166527/2801194271.jpeg"
                  alt="Professional using phone"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto" style={{ backgroundColor: '#0D2D25' }}>
          <div className="mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="py-6 sm:py-8 md:py-12 lg:py-16 flex flex-col items-center gap-3 sm:gap-4 md:gap-6">
            {/* Logo */}
            <div className="rounded-full bg-[#ffffff] p-2 sm:p-2.5">
              <img
                src="https://ext.same-assets.com/3822166527/1817242854.png"
                alt="Kolos Logo"
                className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24"
                loading="lazy"
              />
            </div>

            {/* Links */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 md:gap-8 items-center">
              <a href="#" className="text-white text-sm sm:text-base hover:opacity-70 transition-opacity min-h-[44px] flex items-center justify-center px-3">
                Onboarding
              </a>
              <a href="https://kolos.network" target="_blank" rel="noopener noreferrer" className="text-white text-sm sm:text-base hover:opacity-70 transition-opacity min-h-[44px] flex items-center justify-center px-3">
                Kolos Website
              </a>
            </div>

            {/* Social */}
            <a href="https://www.linkedin.com/company/kolos-network/" target="_blank" rel="noopener noreferrer" className="mt-1 sm:mt-2 min-w-[44px] min-h-[44px] flex items-center justify-center">
              <img
                src="https://ext.same-assets.com/3822166527/2352490803.png"
                alt="LinkedIn"
                className="w-6 h-6 sm:w-7 sm:h-7 hover:opacity-70 transition-opacity"
                loading="lazy"
              />
            </a>
          </div>

          {/* Copyright */}
          <div className="border-t pt-4 sm:pt-6 md:pt-8 pb-4 sm:pb-6 md:pb-8" style={{ borderColor: '#1a3f35' }}>
            <p className="text-center text-white text-xs sm:text-sm px-3 sm:px-4 leading-relaxed">
              © 2025 Kolos. All rights reserved. Kolos is an independent organization. We are not affiliated with Harvard University.
            </p>
          </div>
        </div>
      </footer>

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingModalOpen}
        onClose={() => setIsOnboardingModalOpen(false)}
        onStart={handleOnboardingStart}
      />

      {/* Voice Widget */}
      <VoiceWidget
        isOpen={isWidgetOpen}
        onClose={() => {
          setIsWidgetOpen(false);
          setInitialVariables(null);
        }}
        autoStart={true}
        initialVariables={initialVariables}
      />

      {/* Email Modal */}
      <EmailModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onSuccess={handleEmailSuccess}
      />
    </div>
    </>
  );
}
