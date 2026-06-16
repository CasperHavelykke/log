import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db, schema } from "@/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Drizzle-adapter pointer mod vores egne tabeller. Vi bruger integer user-IDs
  // (ikke UUID som er Auth.js' default), så alle FK'er fortsætter med at virke.
  // Adapterens type-signatur kræver text PK på users — runtime håndterer integer
  // uden problemer, så vi caster for at omgå type-friktionen.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: DrizzleAdapter(db as any, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.authSessions,
    verificationTokensTable: schema.verificationTokens,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any),

  providers: [
    Resend({
      from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
      // 6-cifret kode i stedet for UUID, så iOS PWA-brugere kan taste den
      // ind i appen frem for at klikke et link (links åbner i Safari, ikke
      // i PWA'en — cookien lander det forkerte sted).
      generateVerificationToken: async () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
      },
      // Send email der både viser koden TOPMOST og link som fallback til
      // desktop-brugere.
      sendVerificationRequest: async ({
        identifier: email,
        url,
        token,
        provider,
      }) => {
        const resendKey = process.env.AUTH_RESEND_KEY;
        if (!resendKey) {
          throw new Error("AUTH_RESEND_KEY mangler");
        }
        const from = provider.from ?? "onboarding@resend.dev";
        const subject = `Login-kode: ${token}`;
        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h1 style="font-size: 18px; color: #1a2436; margin: 0 0 16px;">Din login-kode</h1>
            <div style="font-size: 36px; letter-spacing: 8px; font-weight: 600; color: #1a2436; background: #f4f7fb; padding: 16px 24px; border-radius: 6px; text-align: center; margin: 0 0 16px; font-family: monospace;">
              ${token}
            </div>
            <p style="color: #6b7a92; font-size: 13px; margin: 0 0 16px;">
              Tast koden i Log-appen. Den udløber om 10 minutter.
            </p>
            <hr style="border: 0; border-top: 1px solid #e5e9f0; margin: 24px 0;">
            <p style="color: #6b7a92; font-size: 12px; margin: 0 0 8px;">
              Eller klik linket nedenfor (virker kun i samme browser som du bestilte fra):
            </p>
            <a href="${url}" style="color: #4a90e2; font-size: 12px; word-break: break-all;">${url}</a>
          </div>
        `;
        const text = `Din login-kode: ${token}\n\nTast den i Log-appen. Udløber om 10 minutter.\n\nEller åbn dette link: ${url}`;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from, to: email, subject, html, text }),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Resend fejlede: ${res.status} ${body}`);
        }
      },
    }),
  ],

  session: {
    // DB-baseret session så vi kan revoke individuelle sessions senere.
    strategy: "database",
    maxAge: 90 * 24 * 60 * 60, // 90 dage
  },

  pages: {
    signIn: "/login",
    // Auth.js tilføjer selv ?provider=resend&type=email — vi bruger
    // tilstedeværelsen af 'provider' som signal til at vise check-email-tilstanden.
    verifyRequest: "/login",
  },

  callbacks: {
    // Eksponér user.id på session-objektet (default mangler det for DB-sessions).
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id as unknown as string;
      }
      return session;
    },
  },
});
