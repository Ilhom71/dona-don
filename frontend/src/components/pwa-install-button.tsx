"use client";

import { Download } from "lucide-react";
import { usePwaInstall } from "@/hooks/use-pwa-install";

/**
 * Small round icon-only install button (primary background). Rendered next to
 * "Chiqish" in the sidebar / mobile menu. Hidden when install is unavailable
 * or the app is already installed.
 */
export function PwaInstallButton() {
  const { canInstall, install } = usePwaInstall();
  if (!canInstall) return null;

  return (
    <button
      type="button"
      onClick={install}
      aria-label="Ilovani o'rnatish"
      title="Ilovani o'rnatish"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
    >
      <Download className="h-4 w-4" />
    </button>
  );
}
