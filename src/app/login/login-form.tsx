"use client";

import { useActionState } from "react";
import { Button, Card, Input, Label } from "@/components/ui";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <Card>
      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="username">Brugernavn</Label>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            autoFocus
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Adgangskode</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
        {state.error && (
          <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Logger ind..." : "Log ind"}
        </Button>
      </form>
    </Card>
  );
}
