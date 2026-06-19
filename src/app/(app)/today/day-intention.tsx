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
  const [, start] = useTransition();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const handle = setTimeout(() => {
      start(async () => {
        await saveDayGoals({
          date,
          applicationsTarget: null,
          focusHoursTargetX10: null,
          goalNote: note,
        });
      });
    }, 800);
    return () => clearTimeout(handle);
  }, [note, date]);

  return (
    <div className="mb-4 rounded-md border border-border bg-card px-4 py-3">
      <label className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.5px] text-light">
        <Pencil className="size-3" />
        Mål for i dag
      </label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={note.length > 80 ? 3 : 1}
        placeholder="Hvad er din intention for dagen?"
        className="!border-0 !bg-transparent !p-0 !text-[16px] text-ink sm:!text-[14px]"
      />
    </div>
  );
}
