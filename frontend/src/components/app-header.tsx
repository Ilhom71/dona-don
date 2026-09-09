"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { navGroups, navItems } from "./nav-items";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

function currentTitle(pathname: string) {
  return navItems.find((item) => item.href === pathname)?.label ?? "Dona Don";
}

/**
 * Mobil hamburger menyu - desktop sidebar bilan bir xil 4 ta bo'lim
 * (Kassa/Ombor/Savdo/Arxiv) va accordion mantig'ini ishlatadi
 * (`app-sidebar.tsx`ga qara).
 */
export function AppHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();

  const [openTitles, setOpenTitles] = useState<Record<string, boolean>>(() => {
    const active = navGroups.find((g) => g.items.some((i) => i.href === pathname));
    return active ? { [active.title]: true } : {};
  });

  // Effect o'rniga render paytida moslashtiramiz (React tavsiyasiga ko'ra) -
  // aks holda "setState effect ichida" ogohlantirishi chiqadi.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    const active = navGroups.find((g) => g.items.some((i) => i.href === pathname));
    if (active && !openTitles[active.title]) {
      setOpenTitles((prev) => ({ ...prev, [active.title]: true }));
    }
  }

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          }
        />
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigatsiya</SheetTitle>
          <div className="flex h-14 items-center gap-2 border-b px-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wheat-sack.png" alt="Dona Don" width={28} height={28} />
            <span className="font-semibold">Dona Don</span>
          </div>
          <nav className="space-y-1 overflow-y-auto px-3 py-4">
            {navGroups.map((group) => {
              if (group.items.length === 1) {
                const item = group.items[0];
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={group.title}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
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

              const groupOpen = !!openTitles[group.title];
              const GroupIcon = group.items[0].icon;
              return (
                <div key={group.title}>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenTitles((prev) => ({ ...prev, [group.title]: !prev[group.title] }))
                    }
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted"
                  >
                    <GroupIcon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 text-left">{group.title}</span>
                    <ChevronDown
                      className={cn("h-4 w-4 shrink-0 transition-transform", groupOpen && "rotate-180")}
                    />
                  </button>
                  {groupOpen && (
                    <div className="mt-1 space-y-1 border-l pl-4">
                      {group.items.map((item) => {
                        const active = pathname === item.href;
                        const Icon = item.icon;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-3 rounded-md px-3 py-2 text-sm",
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
            <button
              onClick={() => logout()}
              className="mt-3 flex w-full items-center gap-3 rounded-md border-t px-3 pt-4 pb-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Chiqish
            </button>
          </nav>
        </SheetContent>
      </Sheet>
      <span className="font-medium">{currentTitle(pathname)}</span>
    </header>
  );
}
