const dateTime = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const timeOnly = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const dayOnly = new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" });

export const fmtDateTime = (d: Date | string | number) => dateTime.format(new Date(d));
export const fmtTime = (d: Date | string | number) => timeOnly.format(new Date(d));
export const fmtDay = (d: Date | string | number) => dayOnly.format(new Date(d));

export function fmtRange(start: string | number | Date, end: string | number | Date) {
  return `${fmtDateTime(start)} – ${fmtTime(end)}`;
}

export function fmtDuration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
