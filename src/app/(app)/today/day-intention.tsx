"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { saveDayGoals } from "./actions";

export function DayIntention({
  date,
  initialNote,
}: {
  date: string;
  initialNote: string;
}) {
  const [note, setNote] = useState(initialNote);
  const [focused, setFocused] = useState(false);
  const [, start] = useTransition();
  const isFirstRender = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Sidst kendte server-tilstand — autosaven differ mod den, og fokus-
  // genopfriskningen (nye props efter router.refresh) adopteres kun når
  // der ikke er egne uskrevne ændringer.
  const baselineRef = useRef(initialNote);

  useEffect(() => {
    if (focused || note !== baselineRef.current) return;
    if (initialNote !== note) {
      baselineRef.current = initialNote;
      setNote(initialNote);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialNote, focused]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [note]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (note === baselineRef.current) return;
    const handle = setTimeout(() => {
      const value = note;
      start(async () => {
        // PARTIAL: kun noten sendes — dagens taldele røres ikke.
        const res = await saveDayGoals({ date, goalNote: value });
        if (res.ok) baselineRef.current = value;
      });
    }, 800);
    return () => clearTimeout(handle);
  }, [note, date]);

  return (
    <div className="mb-4 rounded-[10px] bg-gradient-to-r from-[var(--accent-bg)] to-transparent px-8 py-6">
      <label className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.5px] text-light">
        <Pencil className="size-3" />
        Mål for i dag
      </label>
      <textarea
        ref={textareaRef}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        spellCheck={focused}
        rows={1}
        placeholder="Hvad er din intention for dagen?"
        className="font-serif font-semibold !rounded-none !resize-none !border-0 !bg-transparent !p-0 !text-[18px] !leading-snug !min-h-0 !overflow-hidden text-ink sm:!text-[19px]"
      />
    </div>
  );
}
