"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  FileText,
  FolderKanban,
  HeartPulse,
  LineChart,
  NotebookPen,
  Settings,
} from "lucide-react";

const items = [
  { href: "/today", label: "I dag", icon: CalendarDays },
  { href: "/jobs", label: "Job", icon: Briefcase },
  { href: "/projects", label: "Projekter", icon: FolderKanban },
  { href: "/health", label: "Helbred", icon: HeartPulse },
  { href: "/statistik", label: "Statistik", icon: LineChart },
  { href: "/documents", label: "Dokumenter", icon: FileText },
  { href: "/journal", label: "Journal", icon: NotebookPen },
  { href: "/settings", label: "Indstillinger", icon: Settings },
];

export function Nav({ username: _username }: { username: string }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto max-w-5xl px-3 py-2 sm:px-4 sm:py-3">
        <nav className="flex flex-wrap items-center justify-center gap-0.5 sm:gap-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex min-h-[40px] min-w-[40px] touch-manipulation items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition active:bg-border/60 sm:min-h-0 sm:min-w-0 sm:px-2.5 ${
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
      </div>
    </header>
  );
}
