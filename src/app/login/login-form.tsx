"use client";

import { useState } from "react";
import { Button, Card, Input, Label } from "@/components/ui";
import { sendMagicLink } from "./actions";

export function LoginForm({ returnTo = "/" }: { returnTo?: string }) {
  const [pending, setPending] = useState(false);

  return (
    <Card>
      <form
        action={async (formData) => {
          setPending(true);
          try {
            await sendMagicLink(formData);
          } finally {
            setPending(false);
          }
        }}
        className="space-y-4"
      >
        <input type="hidden" name="redirectTo" value={returnTo} />
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="dig@example.com"
            autoFocus
            required
          />
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Sender link..." : "Send mig et login-link"}
        </Button>
        <p className="text-center text-[12px] text-light">
          Vi sender et engangs-link til din mail. Ingen adgangskode.
        </p>
      </form>
    </Card>
  );
}
