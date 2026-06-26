"use server";

import { cookies } from "next/headers";
import type { Theme } from "@/lib/theme";

const COOKIE_NAME = "theme";
const ONE_YEAR = 60 * 60 * 24 * 365;

// Vi kalder bevidst IKKE revalidatePath — klienten har allerede sat
// data-theme optimistisk på <html>, og næste navigation læser cookien
// fra hovedet. revalidatePath("/", "layout") ville invalidere hele
// router-cachen og resultere i at links kræver to klik.
export async function setTheme(theme: Theme) {
  const store = await cookies();
  if (theme === "auto") {
    store.delete(COOKIE_NAME);
  } else {
    store.set(COOKIE_NAME, theme, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: ONE_YEAR,
    });
  }
  return { ok: true as const };
}
