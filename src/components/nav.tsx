"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Briefcase,
  CalendarDays,
  ChefHat,
  Dumbbell,
  FileText,
  FolderKanban,
  HeartPulse,
  LineChart,
  NotebookPen,
  Settings,
} from "lucide-react";

type Item = {
  href: string;
  label: string;
  icon: typeof CalendarDays;
  key: string;
};

const JOBS_ITEM: Item = {
  href: "/jobs",
  label: "Job",
  icon: Briefcase,
  key: "jobs",
};

const TRAINING_ITEM: Item = {
  href: "/traening",
  label: "Træning",
  icon: Dumbbell,
  key: "traening",
};

const PRIMARY_ITEMS: Item[] = [
  { href: "/today", label: "I dag", icon: CalendarDays, key: "today" },
  { href: "/health", label: "Helbred", icon: HeartPulse, key: "health" },
  TRAINING_ITEM,
  { href: "/statistik", label: "Statistik", icon: LineChart, key: "statistik" },
  JOBS_ITEM,
  { href: "/projects", label: "Projekter", icon: FolderKanban, key: "projects" },
];

const ARCHIVE_ITEMS: Item[] = [
  { href: "/opskrifter", label: "Opskrifter", icon: ChefHat, key: "opskrifter" },
  { href: "/documents", label: "Dokumenter", icon: FileText, key: "documents" },
  { href: "/journal", label: "Journal", icon: NotebookPen, key: "journal" },
];

export function Nav({
  jobsPlacement = "primary",
  trainingEnabled = false,
  email,
}: {
  jobsPlacement?: "primary" | "archive" | "hidden";
  trainingEnabled?: boolean;
  email?: string | null;
}) {
  const pathname = usePathname();
  const primary = PRIMARY_ITEMS.filter((i) => {
    if (i.key === "jobs") return jobsPlacement === "primary";
    if (i.key === "traening") return trainingEnabled;
    return true;
  });
  const archive =
    jobsPlacement === "archive" ? [JOBS_ITEM, ...ARCHIVE_ITEMS] : ARCHIVE_ITEMS;
  const initial = (email ?? "?").trim().charAt(0).toUpperCase() || "?";
  const shortEmail =
    email && email.length > 22 ? email.slice(0, 20) + "…" : email ?? "";

  return (
    <aside className="sticky top-0 hidden h-screen w-[224px] shrink-0 flex-col border-r border-hair bg-page px-3.5 py-5 md:flex">
      <div className="mb-3.5 flex items-baseline gap-2 border-b border-hair pb-5">
        <span className="font-serif text-[24px] leading-none text-ink">
          Log
        </span>
        <span className="text-[11px] italic text-dim">loggen.app</span>
      </div>

      <nav className="flex flex-col gap-0.5">
        {primary.map((item) => (
          <NavItem key={item.key} item={item} pathname={pathname} />
        ))}

        <div className="px-2.5 pb-1.5 pt-3.5 text-[10px] font-semibold uppercase tracking-[0.6px] text-dim">
          Arkiv
        </div>
        {archive.map((item) => (
          <NavItem key={item.key} item={item} pathname={pathname} />
        ))}
      </nav>

      <div className="flex-1" />

      <NavItem
        item={{
          href: "/settings",
          label: "Indstillinger",
          icon: Settings,
          key: "settings",
        }}
        pathname={pathname}
      />

      <div className="mt-1.5 flex items-center gap-2.5 border-t border-hair px-2.5 pt-3.5">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-bg text-[13px] font-semibold text-accent-bright">
          {initial}
        </span>
        {email && (
          <span
            className="truncate text-[12px] text-light"
            title={email}
          >
            {shortEmail}
          </span>
        )}
      </div>
    </aside>
  );
}

function NavItem({
  item,
  pathname,
}: {
  item: Item;
  pathname: string;
}) {
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition ${
        active
          ? "bg-accent-bg text-accent-bright"
          : "text-mid hover:bg-bg-subtle hover:text-ink"
      }`}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}
