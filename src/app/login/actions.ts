"use server";

import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";

export async function sendMagicLink(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  if (!email) return;

  // redirect: false → vi håndterer redirect selv så vi kan tage email med
  // ind på næste step (kode-input). Auth.js sender stadig emailen via
  // sendVerificationRequest.
  await signIn("resend", { email, redirect: false });
  redirect(`/login?step=verify&email=${encodeURIComponent(email)}`);
}

export async function verifyCode(formData: FormData): Promise<string | null> {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const code = (formData.get("code") as string | null)?.trim();
  const returnTo = (formData.get("returnTo") as string | null) ?? "/";
  if (!email || !code) return null;

  // Returnér URL'en — klienten navigerer via window.location så browseren
  // laver en ægte HTTP-request. Hvis vi i stedet redirecter fra server-
  // action'en, håndterer Next.js' klient det internt og Set-Cookie fra
  // Auth.js' callback lander aldrig i browserens (eller PWA'ens) cookie-jar.
  const params = new URLSearchParams({
    token: code,
    email,
    callbackUrl: returnTo,
  });
  return `/api/auth/callback/resend?${params.toString()}`;
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
