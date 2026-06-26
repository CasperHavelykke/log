"use client";

import { useRef } from "react";

const SWIPE_THRESHOLD_PX = 50;
const MAX_VERTICAL_RATIO = 0.6;

export function useHorizontalSwipe(opts: {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!start.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    start.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (Math.abs(dy) > Math.abs(dx) * MAX_VERTICAL_RATIO) return;
    if (dx < 0) opts.onSwipeLeft?.();
    else opts.onSwipeRight?.();
  }

  return { onTouchStart, onTouchEnd };
}
