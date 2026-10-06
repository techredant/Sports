import { layFromBack } from "@/lib/betting";
import type { League, Market, MatchEvent, Runner, SportGroup } from "@/lib/types";

export const SAMPLE_NOTICE =
  "Sample matches are on. Add ODDS_API_KEY in .env.local for live odds.";

export const SAMPLE_LEAGUES: League[] = [
  { key: "soccer_india_super_league", group: "Soccer", title: "Indian Super League", active: true },
  { key: "cricket_ipl", group: "Cricket", title: "IPL", active: true },
  { key: "tennis_atp", group: "Tennis", title: "ATP", active: true },
];

function runner(name: string, back: number, bookmaker: string): Runner {
  return { name, back, lay: layFromBack(back), bookmaker };
}

function market(key: Market["key"], title: string, runners: Runner[]): Market {
  return { key, title, runners };
}

export function getSampleEvents(now = Date.now()): MatchEvent[] {
  const at = (hours: number) => new Date(now + hours * 60 * 60 * 1000).toISOString();
  const base = (
    event: Omit<MatchEvent, "source" | "markets"> & { markets: Market[] },
  ): MatchEvent => ({ ...event, source: "sample" });

  return [
    base({
      id: "sample-isl-live",
      sportKey: "soccer_india_super_league",
      sportGroup: "Soccer",
      sportTitle: "Indian Super League",
      commenceTime: at(-0.7),
      home: "Mohun Bagan",
      away: "Mumbai City",
      completed: false,
      scores: [
        { name: "Mohun Bagan", score: "1" },
        { name: "Mumbai City", score: "0" },
      ],
      markets: [
        market("h2h", "Match Odds", [
          runner("Mohun Bagan", 1.72, "Sample Book"),
          runner("Draw", 3.8, "Sample Book"),
          runner("Mumbai City", 5.1, "Sample Book"),
        ]),
        market("totals", "Total Goals", [
          runner("Over 2.5", 1.95, "Sample Book"),
          runner("Under 2.5", 1.87, "Sample Book"),
        ]),
      ],
    }),
    base({
      id: "sample-ipl-live",
      sportKey: "cricket_ipl",
      sportGroup: "Cricket",
      sportTitle: "IPL",
      commenceTime: at(-2),
      home: "Mumbai Indians",
      away: "Chennai Super Kings",
      completed: false,
      scores: [
        { name: "Mumbai Indians", score: "142/4" },
        { name: "Chennai Super Kings", score: "0/0" },
      ],
      markets: [
        market("h2h", "Match Odds", [
          runner("Mumbai Indians", 1.84, "Sample Book"),
          runner("Chennai Super Kings", 2.02, "Sample Book"),
        ]),
      ],
    }),
    base({
      id: "sample-tennis-live",
      sportKey: "tennis_atp",
      sportGroup: "Tennis",
      sportTitle: "ATP",
      commenceTime: at(-1),
      home: "Maya Chen",
      away: "Lina Costa",
      completed: false,
      scores: [
        { name: "Maya Chen", score: "1" },
        { name: "Lina Costa", score: "0" },
      ],
      markets: [
        market("h2h", "Match Odds", [
          runner("Maya Chen", 1.37, "Sample Book"),
          runner("Lina Costa", 3.4, "Sample Book"),
        ]),
        market("totals", "Totals", [
          runner("Over 22.5", 1.91, "Sample Book"),
          runner("Under 22.5", 1.91, "Sample Book"),
        ]),
      ],
    }),
  ];
}

export function sampleEventsFor(sport: string) {
  return getSampleEvents().filter((event) => event.sportKey === sport);
}

export function groupFromKey(sportKey: string): SportGroup | null {
  if (sportKey.startsWith("soccer")) return "Soccer";
  if (sportKey.startsWith("cricket")) return "Cricket";
  if (sportKey.startsWith("tennis")) return "Tennis";
  return null;
}
