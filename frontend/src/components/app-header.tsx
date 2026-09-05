"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { navGroups } from "./nav-items";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

function currentTitle(pathname: string) {
  for (const group of navGroups) {
    for (const item of group.items) {
      if (item.href === pathname) return item.label;
    }
  }
  return "Donadon";
}

export function AppHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();

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
            <img src="/wheat-sack.png" alt="Donadon" width={28} height={28} />
            <span className="font-semibold">Donadon</span>
          </div>
          <nav className="space-y-6 overflow-y-auto px-3 py-4">
            {navGroups.map((group, i) => (
              <div key={i}>
                {group.title && (
                  <p className="mb-1 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {group.title}
                  </p>
                )}
                <div className="space-y-1">
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
              </div>
            ))}
            <button
              onClick={() => logout()}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
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
