"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  FolderKanban,
  HeartPulse,
  LineChart,
  LogOut,
  NotebookPen,
  Settings,
} from "lucide-react";
import { logoutAction } from "@/app/login/actions";

const items = [
  { href: "/today", label: "I dag", icon: CalendarDays },
  { href: "/jobs", label: "Job", icon: Briefcase },
  { href: "/projects", label: "Projekter", icon: FolderKanban },
  { href: "/health", label: "Helbred", icon: HeartPulse },
  { href: "/statistik", label: "Statistik", icon: LineChart },
  { href: "/journal", label: "Journal", icon: NotebookPen },
  { href: "/settings", label: "Indstillinger", icon: Settings },
];

export function Nav({ username }: { username: string }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4">
        <Link href="/" className="text-base font-semibold tracking-tight">
          Log
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-0.5 sm:gap-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm transition sm:px-2.5 ${
                  active
                    ? "bg-accent/15 text-accent"
                    : "text-muted hover:bg-border/40 hover:text-foreground"
                }`}
              >
                <Icon className="size-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction}>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm text-muted transition hover:bg-border/40 hover:text-foreground sm:px-2.5"
            title={`Logget ind som ${username}`}
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Log ud</span>
          </button>
        </form>
      </div>
    </header>
  );
}
