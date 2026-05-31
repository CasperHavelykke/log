export function todayIsoDate(): string {
  return toIsoDate(new Date());
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function mondayOf(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toIsoDate(d);
}

const danishWeekdays = [
  "søndag",
  "mandag",
  "tirsdag",
  "onsdag",
  "torsdag",
  "fredag",
  "lørdag",
];
const danishMonths = [
  "januar",
  "februar",
  "marts",
  "april",
  "maj",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "december",
];

export function formatDanishDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const weekday = danishWeekdays[date.getDay()];
  const month = danishMonths[date.getMonth()];
  return `${weekday} d. ${d}. ${month} ${y}`;
}

export function danishWeekday(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return danishWeekdays[new Date(y, m - 1, d).getDay()];
}

export function danishLongDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${d}. ${danishMonths[m - 1]} ${y}`;
}
