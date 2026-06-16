"use client";

import { useState } from "react";
import { Button, Card, Input, Label } from "@/components/ui";
import { verifyCode } from "./actions";

export function CodeForm({
  email,
  returnTo,
  error,
}: {
  email: string;
  returnTo: string;
  error?: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Card>
      <form
        action={async (formData) => {
          setPending(true);
          try {
            await verifyCode(formData);
          } finally {
            setPending(false);
          }
        }}
        className="space-y-4"
      >
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="returnTo" value={returnTo} />

        <div className="rounded-md border border-border-light bg-bg px-3 py-2 text-[12px] text-mid">
          Vi har sendt en kode til <strong className="text-ink">{email}</strong>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="code">6-cifret kode fra mailen</Label>
          <Input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            maxLength={6}
            pattern="[0-9]{6}"
            autoFocus
            required
            style={{
              fontFamily: "monospace",
              fontSize: "20px",
              letterSpacing: "8px",
              textAlign: "center",
            }}
          />
        </div>

        {error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            Forkert eller udløbet kode.
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Verificerer..." : "Log ind"}
        </Button>

        <p className="text-center text-[12px] text-light">
          Modtog du intet? Kig i spam — eller{" "}
          <a href="/login" className="underline">
            send en ny kode
          </a>
          .
        </p>
      </form>
    </Card>
  );
}
