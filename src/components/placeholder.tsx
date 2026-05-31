import { Card } from "@/components/ui";

export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>
      <Card>
        <p className="text-sm text-muted">{blurb}</p>
        <p className="mt-3 text-xs text-muted">Bygges i en senere fase.</p>
      </Card>
    </div>
  );
}
