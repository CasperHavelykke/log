import { requireUser } from "@/lib/session";
import { getAllDayEntries } from "@/lib/queries";
import { JournalPage } from "./journal-page";

export const metadata = { title: "Journal | Log" };

export default async function Journal() {
  const user = await requireUser();
  const entries = await getAllDayEntries(user.id);

  const withNotes = entries.filter(
    (e) =>
      e.workNotes ||
      e.dayNotes ||
      e.wentWell ||
      e.nextStep ||
      e.healthNotes,
  );

  return (
    <JournalPage
      entries={withNotes.map((e) => ({
        date: e.date,
        workNotes: e.workNotes ?? "",
        dayNotes: e.dayNotes ?? "",
        wentWell: e.wentWell ?? "",
        nextStep: e.nextStep ?? "",
        healthNotes: e.healthNotes ?? "",
        mood: e.mood,
        energy: e.energy,
      }))}
    />
  );
}
