"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";

export default function ClientBody({ children }) {
  // Remove any extension-added classes during hydration
  useEffect(() => {
    // This runs only on the client after hydration
    document.body.className = "antialiased";
  }, []);

  return (
    <div className="antialiased">
      {children}
      <Toaster position="top-right" richColors />
    </div>
  );
}
