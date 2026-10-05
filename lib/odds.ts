import { layFromBack, roundOdds } from "@/lib/betting";
import {
  SAMPLE_LEAGUES,
  SAMPLE_NOTICE,
  getSampleEvents,
  groupFromKey,
  sampleEventsFor,
} from "@/lib/mock";
import type {
  League,
  Market,
  MatchEvent,
  OddsPayload,
  Runner,
  Scoreboard,
  ScoresPayload,
  SportGroup,
  SportsPayload,
} from "@/lib/types";

const API_BASE = "https://api.the-odds-api.com/v4";
const TTL_MS = 60_000;

const PREFERRED: Record<SportGroup, string[]> = {
  Soccer: ["soccer_epl", "soccer_uefa_champs_league", "soccer_spain_la_liga", "soccer_usa_mls"],
  Basketball: ["basketball_nba", "basketball_euroleague", "basketball_ncaab"],
  Tennis: ["tennis_atp", "tennis_wta"],
  Cricket: ["cricket_ipl", "cricket_international_t20", "cricket_big_bash", "cricket_test_match"],
};

type CacheEntry = { at: number; value: unknown };
const cache = new Map<string, CacheEntry>();

type ApiOutcome = { name: string; price: number; point?: number };
type ApiMarket = { key: string; outcomes?: ApiOutcome[] };
type ApiBookmaker = { key: string; title: string; markets?: ApiMarket[] };
type ApiEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: ApiBookmaker[];
};
type ApiScore = {
  id: string;
  completed?: boolean;
  scores?: { name: string; score: string }[] | null;
};
type ApiSport = {
  key: string;
  group: string;
  title: string;
  active: boolean;
  has_outrights?: boolean;
};

function apiKey() {
  return process.env.ODDS_API_KEY?.trim() || "";
}

async function cached<T>(key: string, loader: () => Promise<T | null>): Promise<T | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await loader();
  if (value != null) cache.set(key, { at: Date.now(), value });
  return value;
}

async function apiGet<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const key = apiKey();
  if (!key) return null;
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("apiKey", key);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

function totalsTitle(group: SportGroup) {
  if (group === "Soccer") return "Total Goals";
  if (group === "Basketball") return "Total Points";
  return "Totals";
}

function bestRunners(bookmakers: ApiBookmaker[], marketKey: "h2h" | "totals", point?: number) {
  const best = new Map<string, { price: number; bookmaker: string }>();
  for (const book of bookmakers) {
    const market = book.markets?.find((item) => item.key === marketKey);
    if (!market?.outcomes) continue;
    for (const outcome of market.outcomes) {
      if (marketKey === "totals" && outcome.point !== point) continue;
      const label =
        marketKey === "totals" && outcome.point != null
          ? `${outcome.name} ${outcome.point}`
          : outcome.name;
      const previous = best.get(label);
      if (!previous || outcome.price > previous.price) {
        best.set(label, { price: outcome.price, bookmaker: book.title });
      }
    }
  }
  return best;
}

function toRunners(best: Map<string, { price: number; bookmaker: string }>, order: string[]) {
  const runners: Runner[] = [];
  const seen = new Set<string>();
  const push = (name: string) => {
    const price = best.get(name);
    if (!price || seen.has(name)) return;
    seen.add(name);
    runners.push({
      name,
      back: roundOdds(price.price),
      lay: layFromBack(price.price),
      bookmaker: price.bookmaker,
    });
  };
  for (const name of order) push(name);
  for (const name of best.keys()) push(name);
  return runners;
}

function popularTotalPoint(bookmakers: ApiBookmaker[]) {
  const counts = new Map<number, number>();
  for (const book of bookmakers) {
    const market = book.markets?.find((item) => item.key === "totals");
    for (const outcome of market?.outcomes ?? []) {
      if (outcome.point == null) continue;
      counts.set(outcome.point, (counts.get(outcome.point) ?? 0) + 1);
    }
  }
  let chosen: number | null = null;
  let highest = -1;
  for (const [point, count] of counts) {
    if (count > highest) {
      chosen = point;
      highest = count;
    }
  }
  return chosen;
}

export function normalizeEvents(raw: ApiEvent[]): MatchEvent[] {
  const events: MatchEvent[] = [];
  for (const item of raw) {
    const sportGroup = groupFromKey(item.sport_key);
    if (!sportGroup) continue;
    const bookmakers = item.bookmakers ?? [];
    const h2h = toRunners(bestRunners(bookmakers, "h2h"), [
      item.home_team,
      "Draw",
      item.away_team,
    ]);
    if (!h2h.length) continue;
    const markets: Market[] = [{ key: "h2h", title: "Match Odds", runners: h2h }];
    const point = popularTotalPoint(bookmakers);
    if (point != null) {
      const totals = toRunners(bestRunners(bookmakers, "totals", point), [
        `Over ${point}`,
        `Under ${point}`,
      ]);
      if (totals.length) {
        markets.push({ key: "totals", title: totalsTitle(sportGroup), runners: totals });
      }
    }
    events.push({
      id: item.id,
      sportKey: item.sport_key,
      sportGroup,
      sportTitle: item.sport_title,
      commenceTime: item.commence_time,
      home: item.home_team,
      away: item.away_team,
      completed: false,
      markets,
      source: "live",
    });
  }
  return events;
}

function mergeScores(events: MatchEvent[], scores: ApiScore[]): MatchEvent[] {
  const byId = new Map(scores.map((score) => [score.id, score]));
  return events.map((event) => {
    const score = byId.get(event.id);
    if (!score) return event;
    return {
      ...event,
      completed: Boolean(score.completed),
      scores: score.scores ?? undefined,
    };
  });
}

async function fetchSports() {
  return cached("sports", () => apiGet<ApiSport[]>("/sports"));
}

async function fetchOdds(sport: string) {
  return cached(`odds:${sport}`, async () => {
    const withTotals = await apiGet<ApiEvent[]>(`/sports/${sport}/odds`, {
      regions: "uk,eu,us",
      markets: "h2h,totals",
      oddsFormat: "decimal",
    });
    if (withTotals) return withTotals;
    return apiGet<ApiEvent[]>(`/sports/${sport}/odds`, {
      regions: "uk,eu,us",
      markets: "h2h",
      oddsFormat: "decimal",
    });
  });
}

async function fetchScores(sport: string) {
  return cached(`scores:${sport}`, () =>
    apiGet<ApiScore[]>(`/sports/${sport}/scores`, { daysFrom: "2" }),
  );
}

function toLeagues(raw: ApiSport[]): League[] {
  return raw
    .filter((sport) => !sport.has_outrights && groupFromKey(sport.key) && sport.active)
    .map((sport) => ({
      key: sport.key,
      group: groupFromKey(sport.key) as SportGroup,
      title: sport.title,
      active: sport.active,
    }));
}

export function pickFeatured(leagues: League[]) {
  const keys: string[] = [];
  const groups: SportGroup[] = ["Soccer", "Basketball", "Tennis", "Cricket"];
  for (const group of groups) {
    const inGroup = leagues.filter((league) => league.group === group && league.active);
    const preferred = PREFERRED[group].find((key) => inGroup.some((league) => league.key === key));
    const chosen = preferred ?? inGroup[0]?.key;
    if (chosen) keys.push(chosen);
  }
  return keys;
}

export async function getLeagues(): Promise<SportsPayload> {
  if (!apiKey()) return { leagues: SAMPLE_LEAGUES, source: "sample" };
  try {
    const raw = await fetchSports();
    const leagues = raw ? toLeagues(raw) : [];
    if (!leagues.length) return { leagues: SAMPLE_LEAGUES, source: "sample" };
    return { leagues, source: "live" };
  } catch {
    return { leagues: SAMPLE_LEAGUES, source: "sample" };
  }
}

export async function getScores(sport: string): Promise<ScoresPayload> {
  if (!apiKey()) {
    return {
      scores: sampleEventsFor(sport).map((event) => ({
        id: event.id,
        completed: event.completed,
        scores: event.scores,
      })),
      source: "sample",
    };
  }
  try {
    const raw = await fetchScores(sport);
    if (!raw) return { scores: [], source: "live" };
    const scores: Scoreboard[] = raw.map((score) => ({
      id: score.id,
      completed: Boolean(score.completed),
      scores: score.scores ?? undefined,
    }));
    return { scores, source: "live" };
  } catch {
    return { scores: [], source: "live" };
  }
}

export async function getOddsForSport(sport: string): Promise<OddsPayload> {
  if (!apiKey()) {
    return {
      events: sampleEventsFor(sport),
      source: "sample",
      notice: SAMPLE_NOTICE,
    };
  }
  try {
    const [rawOdds, rawScores] = await Promise.all([fetchOdds(sport), fetchScores(sport)]);
    if (!rawOdds) {
      return { events: [], source: "live", notice: "Odds are unavailable for this league." };
    }
    return { events: mergeScores(normalizeEvents(rawOdds), rawScores ?? []), source: "live" };
  } catch {
    return { events: [], source: "live", notice: "Odds are unavailable for this league." };
  }
}

export async function getFeatured(): Promise<OddsPayload> {
  if (!apiKey()) {
    return { events: getSampleEvents(), source: "sample", notice: SAMPLE_NOTICE };
  }
  try {
    const { leagues, source } = await getLeagues();
    if (source === "sample") {
      return { events: getSampleEvents(), source: "sample", notice: SAMPLE_NOTICE };
    }
    const keys = pickFeatured(leagues);
    const batches = await Promise.all(keys.map((key) => getOddsForSport(key)));
    const events = batches.flatMap((batch) => batch.events);
    if (!events.length) {
      return {
        events: getSampleEvents(),
        source: "sample",
        notice: "Live odds are unavailable. Showing sample matches.",
      };
    }
    return { events, source: "live" };
  } catch {
    return {
      events: getSampleEvents(),
      source: "sample",
      notice: "Live odds are unavailable. Showing sample matches.",
    };
  }
}
