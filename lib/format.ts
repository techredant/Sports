import type { MatchEvent } from "@/lib/types";

export function formatMoney(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatOdds(value: number) {
  return value.toFixed(2);
}

export function formatWhen(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isInPlay(event: MatchEvent, now = Date.now()) {
  return !event.completed && new Date(event.commenceTime).getTime() <= now;
}

export function isUpcoming(event: MatchEvent, now = Date.now()) {
  return !event.completed && new Date(event.commenceTime).getTime() > now;
}

export function matchScore(event: MatchEvent) {
  if (!event.scores?.length) return null;
  const home = event.scores.find((line) => line.name === event.home);
  const away = event.scores.find((line) => line.name === event.away);
  if (home && away) return `${home.score}-${away.score}`;
  return event.scores.map((line) => line.score).join("-");
}

export function eventStatus(event: MatchEvent, now = Date.now()) {
  if (event.completed) return "Final";
  if (isInPlay(event, now)) return "Live";
  return formatWhen(event.commenceTime);
}
