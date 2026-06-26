import "server-only";

import { cookies } from "next/headers";

export type Theme = "auto" | "light" | "dark";

const COOKIE_NAME = "theme";

export async function getThemePreference(): Promise<Theme> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (value === "light" || value === "dark") return value;
  return "auto";
}

export function resolveDataTheme(pref: Theme): "light" | "dark" | null {
  if (pref === "light") return "light";
  if (pref === "dark") return "dark";
  return null;
}
