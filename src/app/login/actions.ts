"use server";

import { signIn, signOut } from "@/auth";

export async function sendMagicLink(formData: FormData) {
  await signIn("resend", formData);
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
