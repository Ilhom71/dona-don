"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Chrome/Edge fires this event when the app can be installed; it is not in the TS DOM lib yet.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Safari has no install API: the user adds the app manually via the Share/File menu
type SafariKind = "mac-safari" | "ios-safari";

function detectSafari(): SafariKind | null {
  const ua = navigator.userAgent;
  // Chrome, Edge, Firefox, Opera on any platform (incl. iOS) also contain "Safari" in the UA
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Edg|OPR|Android/.test(ua);
  if (!isSafari) return null;
  // iPadOS reports itself as a Mac, so tell them apart by touch support
  const isIos = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return isIos ? "ios-safari" : "mac-safari";
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

interface PwaInstallContextValue {
  /** true when an install button should be shown (native prompt or Safari how-to) */
  canInstall: boolean;
  install: () => void;
}

const PwaInstallContext = createContext<PwaInstallContextValue>({
  canInstall: false,
  install: () => {},
});

export const usePwaInstall = () => useContext(PwaInstallContext);

/**
 * Lives at the app root so `beforeinstallprompt` (fired once, right after page
 * load - often while the login page or loading spinner is shown) is never missed.
 */
export function PwaInstallProvider({ children }: { children: React.ReactNode }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  // Browser-only value: server snapshot is null, so no hydration mismatch
  const detectedSafari = useSyncExternalStore(
    () => () => {},
    () => (isStandalone() ? null : detectSafari()),
    () => null
  );
  const safari = installed ? null : detectedSafari;
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    // Service worker is required for installability
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // keep the event so we can trigger the prompt on click
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallEvent(null);
      setInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (installEvent) {
      await installEvent.prompt();
      await installEvent.userChoice;
      // The event can only be used once
      setInstallEvent(null);
      return;
    }
    setHelpOpen(true);
  }, [installEvent]);

  const value = useMemo(
    () => ({ canInstall: !!installEvent || !!safari, install }),
    [installEvent, safari, install]
  );

  return (
    <PwaInstallContext.Provider value={value}>
      {children}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ilovani o&apos;rnatish</DialogTitle>
            <DialogDescription>
              Safari brauzeri avtomatik o&apos;rnatishni qo&apos;llamaydi, qo&apos;lda qo&apos;shing:
            </DialogDescription>
          </DialogHeader>
          {safari === "ios-safari" ? (
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Safari pastidagi (yoki yuqoridagi) <b>Ulashish</b> (Share) tugmasini bosing.</li>
              <li><b>Bosh ekranga qo&apos;shish</b> (Add to Home Screen) ni tanlang.</li>
              <li><b>Qo&apos;shish</b> (Add) tugmasini bosing.</li>
            </ol>
          ) : (
            <>
              <ol className="list-decimal space-y-2 pl-5 text-sm">
                <li>Safari yuqori menyusidan <b>Fayl</b> (File) ni oching.</li>
                <li><b>Dock&apos;ga qo&apos;shish</b> (Add to Dock) ni tanlang.</li>
                <li><b>Qo&apos;shish</b> (Add) tugmasini bosing.</li>
              </ol>
              <p className="text-xs text-muted-foreground">
                Kerak: macOS Sonoma (14) yoki yangiroq va Safari 17+.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </PwaInstallContext.Provider>
  );
}
