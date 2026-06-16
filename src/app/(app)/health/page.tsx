import { requireUser } from "@/lib/session";
import { getAllDayEntries, getAllSleepEntries } from "@/lib/queries";
import { listTrackers } from "./trackere/actions";
import { listCustomParameters } from "@/lib/custom-parameters";
import { HealthCalendar } from "./health-calendar";

export const metadata = { title: "Helbred | Log" };

export default async function Health() {
  const user = await requireUser();
  const [entries, sleeps, trackers, customParameters] = await Promise.all([
    getAllDayEntries(user.id),
    getAllSleepEntries(user.id),
    listTrackers(false),
    listCustomParameters(false),
  ]);

  return (
    <HealthCalendar
      trackers={trackers.map((t) => ({ id: t.id, name: t.name, kind: t.kind }))}
      customParameters={customParameters}
      sleepEntries={sleeps.map((s) => ({
        date: s.date,
        durationMin: s.durationMin,
        score: s.score,
        qualityLabel: s.qualityLabel,
        deepMin: s.deepMin,
        lightMin: s.lightMin,
        remMin: s.remMin,
        awakeMin: s.awakeMin,
        avgStress: s.avgStress,
        avgHeartRate: s.avgHeartRate,
        restingHeartRate: s.restingHeartRate,
        bodyBatteryChange: s.bodyBatteryChange,
        avgSpO2: s.avgSpO2,
        lowestSpO2: s.lowestSpO2,
        avgBreathingX10: s.avgBreathingX10,
        hrvMs: s.hrvMs,
        hrv7dStatus: s.hrv7dStatus,
      }))}
      entries={entries.map((e) => ({
        date: e.date,
        mood: e.mood,
        energy: e.energy,
        sleepHoursX10: e.sleepHours,
        sleepQuality: e.sleepQuality,
        headache: e.headache,
        headacheIntensity: e.headacheIntensity,
        iskiasPain: e.iskiasPain,
        alcoholUnits: e.alcoholUnits,
        constipation: e.constipation,
        constipationPain: e.constipationPain,
        seborrheicDermatitis: e.seborrheicDermatitis,
        staph: e.staph,
        didExercise: e.didExercise ?? false,
        exerciseIntensity:
          (e.exerciseIntensity as "light" | "medium" | "hard" | null) ?? null,
        didFast: e.didFast ?? false,
        fastHoursX10: e.fastHoursX10 ?? null,
        fastBreakTime: e.fastBreakTime ?? null,
        weightX10: e.weightX10 ?? null,
        waistX10: e.waistX10 ?? null,
        carbsG: e.carbsG ?? null,
        proteinG: e.proteinG ?? null,
        fatG: e.fatG ?? null,
        breathingDifficulty: e.breathingDifficulty ?? null,
        breathingContext: e.breathingContext ?? "",
        foamyUrine: e.foamyUrine ?? false,
        foamyUrinePattern:
          (e.foamyUrinePattern as "morning" | "all_day" | null) ?? null,
        healthNotes: e.healthNotes ?? "",
        workNotes: e.workNotes ?? "",
        dayNotes: e.dayNotes ?? "",
        wentWell: e.wentWell ?? "",
        nextStep: e.nextStep ?? "",
      }))}
    />
  );
}
