import { layFromBack, roundOdds } from "@/lib/betting";
import {
  SAMPLE_LEAGUES,
  SAMPLE_NOTICE,
  getSampleEvents,
  groupFromKey,
  sampleEventsFor,
} from "@/lib/mock";
import { SPORT_GROUPS } from "@/lib/types";
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

export const USE_ODDS_API = false;

const API_BASE = "https://api.the-odds-api.com/v4";
const TTL_MS = 60_000;

const PREFERRED: Record<SportGroup, string[]> = {
  Cricket: ["cricket_ipl", "cricket_international_t20", "cricket_odi", "cricket_test_match"],
  Soccer: ["soccer_india_super_league", "soccer_epl", "soccer_uefa_champs_league"],
  Tennis: ["tennis_atp", "tennis_wta"],
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

export class OddsQuotaError extends Error {
  constructor() {
    super("Odds usage quota has been reached.");
    this.name = "OddsQuotaError";
  }
}

let quotaUntil = 0;

async function apiGet<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  if (Date.now() < quotaUntil) throw new OddsQuotaError();
  const key = apiKey();
  if (!key) return null;
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set("apiKey", key);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12_000) });
  if (!response.ok) {
    if (response.status === 401 || response.status === 429) {
      const body = await response.text();
      if (response.status === 429 || body.includes("OUT_OF_USAGE_CREDITS")) {
        quotaUntil = Date.now() + 30 * 60 * 1000;
        throw new OddsQuotaError();
      }
    }
    return null;
  }
  return (await response.json()) as T;
}

function totalsTitle(group: SportGroup) {
  if (group === "Soccer") return "Total Goals";
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

function leagueRank(league: League) {
  const index = PREFERRED[league.group].indexOf(league.key);
  return index === -1 ? PREFERRED[league.group].length : index;
}

function toLeagues(raw: ApiSport[]): League[] {
  return raw
    .filter((sport) => !sport.has_outrights && groupFromKey(sport.key) && sport.active)
    .map((sport) => ({
      key: sport.key,
      group: groupFromKey(sport.key) as SportGroup,
      title: sport.title,
      active: sport.active,
    }))
    .sort((a, b) => {
      const byGroup = SPORT_GROUPS.indexOf(a.group) - SPORT_GROUPS.indexOf(b.group);
      if (byGroup !== 0) return byGroup;
      const byRank = leagueRank(a) - leagueRank(b);
      if (byRank !== 0) return byRank;
      return a.title.localeCompare(b.title);
    });
}

const INDIA_MARKERS = [
  "india",
  "mumbai indians",
  "chennai super kings",
  "kolkata knight riders",
  "royal challengers",
  "delhi capitals",
  "punjab kings",
  "rajasthan royals",
  "sunrisers",
  "gujarat titans",
  "lucknow super giants",
  "mohun bagan",
  "mumbai city",
  "bengaluru",
  "kerala blasters",
  "odisha fc",
  "fc goa",
  "northeast united",
  "chennaiyin",
  "east bengal",
  "jamshedpur",
  "hyderabad fc",
  "punjab fc",
  "sumit nagal",
  "rohan bopanna",
  "yuki bhambri",
  "ramkumar ramanathan",
];

export function involvesIndia(event: Pick<MatchEvent, "home" | "away" | "sportKey">) {
  if (event.sportKey === "cricket_ipl" || event.sportKey === "soccer_india_super_league") return true;
  const text = `${event.home} ${event.away}`.toLowerCase();
  return INDIA_MARKERS.some((marker) => text.includes(marker));
}

export function pickFeatured(leagues: League[]) {
  const activeLeagues = leagues.filter((league) => league.active);
  const active = new Set(activeLeagues.map((league) => league.key));
  const soccer = PREFERRED.Soccer.find((key) => active.has(key));
  const tennis = activeLeagues.filter((league) => league.group === "Tennis").map((league) => league.key);
  return [...PREFERRED.Cricket.filter((key) => active.has(key)), ...(soccer ? [soccer] : []), ...tennis.slice(0, 2)];
}

function demoEvents() {
  return getSampleEvents().sort((a, b) => {
    const india = Number(involvesIndia(b)) - Number(involvesIndia(a));
    if (india !== 0) return india;
    return new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime();
  });
}

export async function getLeagues(): Promise<SportsPayload> {
  if (!USE_ODDS_API || !apiKey()) return { leagues: SAMPLE_LEAGUES, source: "sample" };
  try {
    const raw = await fetchSports();
    const leagues = raw ? toLeagues(raw) : [];
    if (!leagues.length) return { leagues: SAMPLE_LEAGUES, source: "sample" };
    return { leagues, source: "live" };
  } catch (error) {
    if (error instanceof OddsQuotaError) throw error;
    return { leagues: SAMPLE_LEAGUES, source: "sample" };
  }
}

export async function getScores(sport: string): Promise<ScoresPayload> {
  if (!USE_ODDS_API || !apiKey()) {
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
  } catch (error) {
    if (error instanceof OddsQuotaError) throw error;
    return { scores: [], source: "live" };
  }
}

export async function getOddsForSport(sport: string): Promise<OddsPayload> {
  if (!USE_ODDS_API || !apiKey()) {
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
  } catch (error) {
    if (error instanceof OddsQuotaError) throw error;
    return { events: [], source: "live", notice: "Odds are unavailable for this league." };
  }
}

export async function getFeatured(): Promise<OddsPayload> {
  if (!USE_ODDS_API || !apiKey()) {
    return { events: demoEvents(), source: "sample", notice: SAMPLE_NOTICE };
  }
  try {
    const { leagues, source } = await getLeagues();
    if (source === "sample") {
      return { events: getSampleEvents(), source: "sample", notice: SAMPLE_NOTICE };
    }
    const keys = pickFeatured(leagues);
    const batches = await Promise.all(keys.map((key) => getOddsForSport(key)));
    const events = batches.flatMap((batch) => batch.events).sort((a, b) => {
      const india = Number(involvesIndia(b)) - Number(involvesIndia(a));
      if (india !== 0) return india;
      return new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime();
    });
    if (!events.length) {
      return {
        events: [],
        source: "live",
        notice: "No matches with odds are on the board right now.",
      };
    }
    return { events, source: "live" };
  } catch {
    return { events: demoEvents(), source: "sample", notice: SAMPLE_NOTICE };
  }
}
