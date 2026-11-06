"use client";

import { useState, useTransition } from "react";
import {
  removeProfileImage,
  uploadProfileImage,
} from "../jobs/profile-image-actions";
import { CircleUserRound, ImagePlus, Loader2, Trash2 } from "lucide-react";

export function ProfileImageField({
  initialHasImage,
}: {
  initialHasImage: boolean;
}) {
  const [hasImage, setHasImage] = useState(initialHasImage);
  // Tæller op ved hvert skift, så <img> henter billedet på ny.
  const [version, setVersion] = useState(0);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onPick(file: File | undefined) {
    if (!file) return;
    setErr(null);
    start(async () => {
      const fd = new FormData();
      fd.set("file", file);
      const res = await uploadProfileImage(fd);
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setHasImage(true);
      setVersion((v) => v + 1);
    });
  }

  function remove() {
    setErr(null);
    start(async () => {
      const res = await removeProfileImage();
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      setHasImage(false);
    });
  }

  return (
    <div className="mt-4 border-t border-hair pt-4">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.5px] text-light">
        Profilbillede til CV
      </div>

      <div className="flex items-center gap-3">
        {hasImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/profile-image?v=${version}`}
            alt="Dit profilbillede"
            className="size-16 shrink-0 rounded-[10px] object-cover"
          />
        )}
        {!hasImage && (
          <div className="flex size-16 shrink-0 items-center justify-center rounded-[10px] border border-dashed border-hair-strong">
            <CircleUserRound className="size-6 text-dim" />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-[8px] bg-bg-subtle px-3 text-[12px] text-mid hover:text-ink">
            {pending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <ImagePlus className="size-3.5" />
            )}
            {hasImage ? "Skift billede" : "Vælg billede"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={pending}
              onChange={(e) => {
                onPick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>

          {hasImage && (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-[8px] px-3 text-[12px] text-mid hover:text-danger disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
              Fjern
            </button>
          )}
        </div>
      </div>

      {err && <p className="mt-2 text-[13px] text-danger">{err}</p>}
      <p className="mt-2 text-[11px] italic text-light">
        Bruges når AI gemmer et CV i Loggen. Billedet skaleres ned automatisk.
      </p>
    </div>
  );
}
