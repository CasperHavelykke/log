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
      // Resend kører i "sandbox"-mode uden et verificeret domæne — den kan
      // kun sende til kontoens egen verificerede email. Det er fint mens vi
      // er solo. Når domænet er klar, skift FROM til fx login@dit-domæne.dk.
      from: process.env.EMAIL_FROM ?? "onboarding@resend.dev",
    }),
  ],

  session: {
    // DB-baseret session så vi kan revoke individuelle sessions senere.
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 dage
  },

  pages: {
    signIn: "/login",
    verifyRequest: "/login?check-email=1",
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
