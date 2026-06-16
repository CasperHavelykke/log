import bcrypt from "bcryptjs";

// Generisk bcrypt-wrapper — bruges nu kun til MCP OAuth client-secrets,
// ikke bruger-adgangskoder (de håndteres af Auth.js).
const COST = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COST);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
