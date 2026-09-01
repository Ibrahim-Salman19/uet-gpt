"use client";

import { useEffect, useState } from "react";

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem("uet_cookie_consent");
      if (!consent) {
        setShow(true);
      }
    } catch {
      // Ignore localStorage access errors
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem("uet_cookie_consent", "accepted");
    } catch {
      // Ignore localStorage write errors
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <aside
      aria-label="Cookie consent banner"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl rounded-lg border border-white/10 bg-[#07080a]/95 p-4 backdrop-blur-md shadow-2xl"
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-white/70">
          We use essential cookies and local storage to preserve your chat history and theme
          preferences.
        </p>
        <button
          type="button"
          onClick={handleAccept}
          className="min-h-[44px] min-w-[44px] whitespace-nowrap rounded bg-[#d9b451] px-4 py-2 text-xs font-semibold text-[#07080a] hover:bg-[#f0d178] transition-colors"
        >
          Got it
        </button>
      </div>
    </aside>
  );
}
