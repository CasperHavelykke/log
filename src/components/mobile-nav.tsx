"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Briefcase,
  CalendarDays,
  FileText,
  FolderKanban,
  HeartPulse,
  LineChart,
  MoreHorizontal,
  NotebookPen,
  Settings,
} from "lucide-react";

type Item = {
  href: string;
  label: string;
  icon: typeof CalendarDays;
  key: string;
};

const ALL_ITEMS: Item[] = [
  { href: "/today", label: "I dag", icon: CalendarDays, key: "today" },
  { href: "/health", label: "Helbred", icon: HeartPulse, key: "health" },
  { href: "/statistik", label: "Statistik", icon: LineChart, key: "statistik" },
  { href: "/jobs", label: "Job", icon: Briefcase, key: "jobs" },
  { href: "/projects", label: "Projekter", icon: FolderKanban, key: "projects" },
  { href: "/documents", label: "Dokumenter", icon: FileText, key: "documents" },
  { href: "/journal", label: "Journal", icon: NotebookPen, key: "journal" },
  { href: "/settings", label: "Indstillinger", icon: Settings, key: "settings" },
];

export function MobileNav({ showJobs }: { showJobs: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Items visible in persistent bar — Job tager Projekters plads når aktiv
  const visibleItems = ALL_ITEMS.filter((i) => {
    if (i.key === "today" || i.key === "health" || i.key === "statistik") return true;
    if (i.key === "jobs") return showJobs;
    return false;
  });

  // Items i drawer = alle minus job hvis ikke aktiv
  const drawerItems = ALL_ITEMS.filter((i) => i.key !== "jobs" || showJobs);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  // Swipe up gesture på bar'en
  const touchStartY = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current === null) return;
    const delta = touchStartY.current - e.changedTouches[0].clientY;
    if (delta > 40) setOpen(true);
    touchStartY.current = null;
  }

  // Luk drawer på Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Backdrop — vises kun når drawer er åben */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
      />

      {/* Drawer */}
      <Drawer
        open={open}
        items={drawerItems}
        activePathname={pathname}
        onClose={() => setOpen(false)}
        isActive={isActive}
      />

      {/* Persistent bottom bar — skjules når drawer er åben så det ikke ser ud
          som to lag der overlapper. */}
      <nav
        className={`fixed bottom-0 left-0 right-0 z-50 bg-bg/95 backdrop-blur-lg transition-opacity md:hidden ${
          open ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6px)" }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* Subtil top-skygge i stedet for border — undgår dobbeltkant
            sammen med drag-handle. */}
        <div
          className="pointer-events-none absolute -top-px left-0 right-0 h-px bg-gradient-to-b from-transparent to-black/20"
          aria-hidden
        />
        {/* drag handle */}
        <div
          className="mx-auto mb-1 mt-2 h-1 w-9 rounded-full bg-border-strong"
          aria-hidden
        />
        <div
          className="grid pt-1"
          style={{
            gridTemplateColumns: `repeat(${visibleItems.length + 1}, minmax(0, 1fr))`,
          }}
        >
          {visibleItems.map(({ href, label, icon: Icon, key }) => {
            const active = isActive(href);
            return (
              <Link
                key={key}
                href={href}
                className={`flex min-h-[52px] cursor-pointer flex-col items-center justify-center gap-1 px-1 text-[10px] ${
                  active ? "text-accent" : "text-light"
                }`}
              >
                <Icon
                  className="size-5"
                  strokeWidth={active ? 2.4 : 2}
                />
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`flex min-h-[52px] cursor-pointer flex-col items-center justify-center gap-1 px-1 text-[10px] ${
              open ? "text-accent" : "text-light"
            }`}
          >
            <MoreHorizontal className="size-5" />
            Mere
          </button>
        </div>
      </nav>
    </>
  );
}

function Drawer({
  open,
  items,
  onClose,
  isActive,
}: {
  open: boolean;
  items: Item[];
  activePathname: string;
  onClose: () => void;
  isActive: (href: string) => boolean;
}) {
  // Swipe ned for at lukke
  const touchStartY = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current === null) return;
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    if (delta > 50) onClose();
    touchStartY.current = null;
  }

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transform border-t border-border-strong bg-bg shadow-2xl transition-transform duration-300 md:hidden ${
        open ? "translate-y-0" : "translate-y-full"
      }`}
      style={{
        borderTopLeftRadius: "24px",
        borderTopRightRadius: "24px",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="mx-auto mt-3 h-1 w-10 rounded-full bg-border-strong"
        aria-hidden
      />
      <div className="px-4 pt-4 pb-2 text-center text-[11px] uppercase tracking-[0.6px] text-light">
        Naviger
      </div>
      <div className="grid grid-cols-3 gap-2 px-4 pb-4">
        {items.map(({ href, label, icon: Icon, key }) => {
          const active = isActive(href);
          return (
            <Link
              key={key}
              href={href}
              onClick={onClose}
              className={`flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-xl border p-3 ${
                active
                  ? "border-accent bg-accent-bg text-accent"
                  : "border-border bg-card text-ink"
              }`}
            >
              <Icon className="size-6" strokeWidth={active ? 2.4 : 2} />
              <span className="text-[12px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
