"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Kassa", href: "/" },
  { label: "Kassa amaliyotlari", href: "/kassa/amaliyotlari" },
  { label: "Savdolar", href: "/kassa/savdolar" },
  { label: "Hamkorlar", href: "/kassa/hamkorlar" },
  { label: "Buxgalteriya", href: "/kassa/buxgalteriya" },
];

/**
 * Kassa bo'limining o'z ichki nav-tab qatori - har biri bosilganda to'liq
 * alohida sahifa ochiladi (asosiy sidebar nav'dan tashqari, Kassa
 * bo'limining o'zi uchun). Barcha 5 ta Kassa sahifasining tepasida ishlatiladi.
 * "Kassa" - faqat kunlik naqd savdo kassasi, "Buxgalteriya" - firmaning
 * joriy hisobi (rasmiy, kassadan o'tkazma orqali to'ldiriladi).
 */
export function KassaSubNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-1 border-b pb-2">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
