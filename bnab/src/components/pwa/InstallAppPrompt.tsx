"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { buttonPrimaryClass } from "@/components/forms/field-classes";
import { BnabMark } from "@/components/brand/BnabLogo";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "bnab-install-dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const ios =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || ios;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

type Props = {
  /** Compact card for More page vs sticky mobile banner */
  variant?: "banner" | "card";
  /** Ignore local dismiss (use on More page) */
  persistent?: boolean;
};

/**
 * Proposes installing BNAB as an Android/iOS home-screen app.
 * Uses beforeinstallprompt on Chromium; shows Share guidance on iOS.
 */
export function InstallAppPrompt({
  variant = "banner",
  persistent = false,
}: Props) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [visible, setVisible] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (!persistent && localStorage.getItem(DISMISS_KEY) === "1") return;

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
      setIosHint(false);
    };
    window.addEventListener("beforeinstallprompt", onBip);

    const t = window.setTimeout(() => {
      if (isStandalone()) return;
      if (!persistent && localStorage.getItem(DISMISS_KEY) === "1") return;
      if (isIos()) {
        setIosHint(true);
        setVisible(true);
      } else if (isAndroid() || persistent) {
        setVisible(true);
      }
    }, persistent ? 0 : 1800);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.clearTimeout(t);
    };
  }, [persistent]);

  if (!visible) return null;

  const dismiss = () => {
    if (!persistent) localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      setVisible(false);
      localStorage.setItem(DISMISS_KEY, "1");
    } finally {
      setBusy(false);
    }
  };

  const body = (
    <>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg">
          <BnabMark className="size-7" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-fg">
            {isIos() ? "Add BNAB to your Home Screen" : "Install BNAB on Android"}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-fg-muted">
            {iosHint
              ? "Tap Share, then “Add to Home Screen” for a full-screen app icon."
              : deferred
                ? "Install for one-tap access, home-screen icon, and faster reloads."
                : "Open Chrome menu → Install app / Add to Home screen for a full-screen shortcut."}
          </p>
          {iosHint ? (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-fg-subtle">
              <Share className="size-3.5" aria-hidden />
              Share → Add to Home Screen
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {deferred ? (
          <button
            type="button"
            disabled={busy}
            onClick={install}
            className={`${buttonPrimaryClass} gap-1.5 px-3 py-2 text-xs`}
          >
            <Download className="size-3.5" />
            {busy ? "…" : "Install"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex size-9 items-center justify-center rounded-full text-fg-muted hover:bg-overlay hover:text-fg"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    </>
  );

  if (variant === "card") {
    return (
      <section className="rounded-2xl border border-accent/35 bg-accent-muted/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {body}
        </div>
        {!deferred && !iosHint ? (
          <p className="mt-3 text-[11px] text-fg-subtle">
            On Android Chrome: ⋮ menu → <strong className="text-fg-muted">Install app</strong>{" "}
            or <strong className="text-fg-muted">Add to Home screen</strong>.
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <div
      className="fixed inset-x-0 bottom-[4.75rem] z-40 px-3 md:bottom-4 md:left-auto md:right-4 md:w-[22rem] md:px-0"
      role="dialog"
      aria-label="Install BNAB"
    >
      <div className="flex items-start gap-2 rounded-2xl border border-rim/70 bg-surface/95 p-3 shadow-[0_12px_40px_color-mix(in_oklch,var(--glow-accent)_35%,transparent)] backdrop-blur-md">
        {body}
      </div>
    </div>
  );
}

/** Always-visible install entry for More — resets dismiss to show guidance. */
export function InstallAppCard() {
  const [standalone, setStandalone] = useState(true);

  useEffect(() => {
    setStandalone(isStandalone());
  }, []);

  if (standalone) {
    return (
      <section className="rounded-2xl border border-rim-subtle bg-surface p-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-ok/20 text-ok">
            <BnabMark className="size-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-fg">BNAB is installed</p>
            <p className="text-xs text-fg-muted">
              You&apos;re running the home-screen app.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <InstallAppPrompt variant="card" persistent />
  );
}

export function clearInstallDismiss() {
  localStorage.removeItem(DISMISS_KEY);
}
