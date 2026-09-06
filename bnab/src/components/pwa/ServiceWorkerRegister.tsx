"use client";

import { useEffect } from "react";

/** Registers the BNAB service worker once on the client. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* ignore — install still works without SW on modern Chrome */
      });
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(register, { timeout: 2500 });
    } else {
      setTimeout(register, 1200);
    }
  }, []);

  return null;
}
