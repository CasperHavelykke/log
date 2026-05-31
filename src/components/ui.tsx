import { forwardRef, type ComponentPropsWithoutRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-foreground hover:opacity-90 focus-visible:ring-accent",
  secondary:
    "bg-card border border-border text-foreground hover:bg-border/40 focus-visible:ring-accent",
  ghost:
    "bg-transparent text-foreground hover:bg-border/40 focus-visible:ring-accent",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<"button"> & { variant?: Variant }
>(({ className = "", variant = "primary", ...props }, ref) => (
  <button
    ref={ref}
    {...props}
    className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${className}`}
  />
));
Button.displayName = "Button";

export const Input = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input">>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      {...props}
      className={`w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50 ${className}`}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  ComponentPropsWithoutRef<"textarea">
>(({ className = "", ...props }, ref) => (
  <textarea
    ref={ref}
    {...props}
    className={`w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50 ${className}`}
  />
));
Textarea.displayName = "Textarea";

export function Label({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"label">) {
  return (
    <label
      {...props}
      className={`block text-sm font-medium text-foreground ${className}`}
    />
  );
}

export function Card({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      {...props}
      className={`rounded-2xl border border-border bg-card p-6 shadow-sm ${className}`}
    />
  );
}

export function FieldHint({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"p">) {
  return <p {...props} className={`text-xs text-muted ${className}`} />;
}
