"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { navGroups } from "./nav-items";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

/**
 * Sidebarda aynan 4 ta bo'lim (Kassa/Ombor/Savdo/Arxiv) ko'rinadi -
 * foydalanuvchi so'roviga ko'ra. Ko'p sahifali bo'limlar (Kassa/Ombor/Savdo)
 * bosilganda ochilib/yopilib turadi (accordion), ichidagi sahifalar shu
 * bo'lim ostida joylashadi. Joriy sahifa qaysi bo'limga tegishli bo'lsa,
 * o'sha bo'lim boshida avtomatik ochiq holatda keladi.
 */
export function AppSidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();

  const [openTitles, setOpenTitles] = useState<Record<string, boolean>>(() => {
    const active = navGroups.find((g) => g.items.some((i) => i.href === pathname));
    return active ? { [active.title]: true } : {};
  });

  // Boshqa sahifaga o'tilganda (masalan "Ombor" ochiq bo'lgan holda "Savdo"
  // ichidagi havola bosilsa) yangi joriy bo'lim ham avtomatik ochiladi -
  // avvalgi ochiq bo'limlar yopilmaydi, faqat qo'shiladi. Effect o'rniga
  // render paytida moslashtiramiz (React'ning tavsiyasiga ko'ra) - aks
  // holda "setState effect ichida" ogohlantirishi (cascading render xavfi)
  // chiqadi.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    const active = navGroups.find((g) => g.items.some((i) => i.href === pathname));
    if (active && !openTitles[active.title]) {
      setOpenTitles((prev) => ({ ...prev, [active.title]: true }));
    }
  }

  return (
    <aside className="hidden w-64 shrink-0 border-r bg-background md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/wheat-sack.png" alt="Dona Don" width={32} height={32} />
        <span className="font-semibold">Dona Don</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => {
          // Bitta sahifali bo'lim (Arxiv) - oddiy alohida havola, accordion shart emas.
          if (group.items.length === 1) {
            const item = group.items[0];
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={group.title}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/80 hover:bg-muted"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {group.title}
              </Link>
            );
          }

          const open = !!openTitles[group.title];
          const GroupIcon = group.items[0].icon;
          return (
            <div key={group.title}>
              <button
                type="button"
                onClick={() => setOpenTitles((prev) => ({ ...prev, [group.title]: !prev[group.title] }))}
                className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-muted"
              >
                <GroupIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{group.title}</span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} />
              </button>
              {open && (
                <div className="mt-1 space-y-1 border-l pl-4">
                  {group.items.map((item) => {
                    const active = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                          active
                            ? "bg-primary text-primary-foreground font-medium"
                            : "text-foreground/80 hover:bg-muted"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Chiqish
        </button>
      </div>
    </aside>
  );
}
