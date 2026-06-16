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

export async function verifyCode(formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const code = (formData.get("code") as string | null)?.trim();
  const returnTo = (formData.get("returnTo") as string | null) ?? "/";
  if (!email || !code) return;

  // Send brugeren igennem Auth.js' callback — den slår token op,
  // opretter session og sætter cookie i samme cookie-jar som requesten
  // (PWA'ens, hvis det er der brugeren tastede koden).
  const params = new URLSearchParams({
    token: code,
    email,
    callbackUrl: returnTo,
  });
  redirect(`/api/auth/callback/resend?${params.toString()}`);
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
