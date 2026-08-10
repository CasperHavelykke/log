import "server-only";

// Demo-mode: sat via miljøvariabel på den separate demo-instans
// (demo.loggen.app). SKAL læses ved runtime — aldrig bages ind i buildet —
// så produktions- og demo-instansen kan dele samme .next-build.
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "1";
}

// Emailen som seed-scriptet opretter demo-brugeren med. Bruges til opslag
// i requireUser/getCurrentUser når DEMO_MODE er aktiv.
export const DEMO_USER_EMAIL = "demo@loggen.app";

export const DEMO_BLOCKED_MESSAGE =
  "Ikke tilgængelig i demoen — data nulstilles automatisk.";
