import { layFromBack } from "@/lib/betting";
import type { League, Market, MatchEvent, Runner, SportGroup } from "@/lib/types";

export const SAMPLE_NOTICE =
  "Sample matches are on. Add ODDS_API_KEY in .env.local for live odds.";

export const SAMPLE_LEAGUES: League[] = [
  { key: "tennis_atp", group: "Tennis", title: "ATP", active: true },
  { key: "soccer_epl", group: "Soccer", title: "EPL", active: true },
  { key: "basketball_nba", group: "Basketball", title: "NBA", active: true },
  { key: "cricket_international_t20", group: "Cricket", title: "International T20", active: true },
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
    base({
      id: "sample-tennis-upcoming",
      sportKey: "tennis_atp",
      sportGroup: "Tennis",
      sportTitle: "ATP",
      commenceTime: at(5),
      home: "Noah Berg",
      away: "Eli Markov",
      completed: false,
      markets: [
        market("h2h", "Match Odds", [
          runner("Noah Berg", 1.62, "Sample Book"),
          runner("Eli Markov", 2.35, "Sample Book"),
        ]),
      ],
    }),
    base({
      id: "sample-soccer-live",
      sportKey: "soccer_epl",
      sportGroup: "Soccer",
      sportTitle: "EPL",
      commenceTime: at(-0.7),
      home: "Northbridge",
      away: "Harbour Athletic",
      completed: false,
      scores: [
        { name: "Northbridge", score: "1" },
        { name: "Harbour Athletic", score: "0" },
      ],
      markets: [
        market("h2h", "Match Odds", [
          runner("Northbridge", 1.72, "Sample Book"),
          runner("Draw", 3.8, "Sample Book"),
          runner("Harbour Athletic", 5.1, "Sample Book"),
        ]),
        market("totals", "Total Goals", [
          runner("Over 2.5", 1.95, "Sample Book"),
          runner("Under 2.5", 1.87, "Sample Book"),
        ]),
      ],
    }),
    base({
      id: "sample-soccer-upcoming",
      sportKey: "soccer_epl",
      sportGroup: "Soccer",
      sportTitle: "EPL",
      commenceTime: at(26),
      home: "Westford",
      away: "Kingswell",
      completed: false,
      markets: [
        market("h2h", "Match Odds", [
          runner("Westford", 2.45, "Sample Book"),
          runner("Draw", 3.25, "Sample Book"),
          runner("Kingswell", 2.9, "Sample Book"),
        ]),
        market("totals", "Total Goals", [
          runner("Over 2.5", 2.05, "Sample Book"),
          runner("Under 2.5", 1.78, "Sample Book"),
        ]),
      ],
    }),
    base({
      id: "sample-soccer-final",
      sportKey: "soccer_epl",
      sportGroup: "Soccer",
      sportTitle: "EPL",
      commenceTime: at(-30),
      home: "Redcliff",
      away: "Oldport",
      completed: true,
      scores: [
        { name: "Redcliff", score: "2" },
        { name: "Oldport", score: "1" },
      ],
      markets: [
        market("h2h", "Match Odds", [
          runner("Redcliff", 1.55, "Sample Book"),
          runner("Draw", 4.1, "Sample Book"),
          runner("Oldport", 6.2, "Sample Book"),
        ]),
        market("totals", "Total Goals", [
          runner("Over 2.5", 1.83, "Sample Book"),
          runner("Under 2.5", 1.99, "Sample Book"),
        ]),
      ],
    }),
    base({
      id: "sample-nba-upcoming",
      sportKey: "basketball_nba",
      sportGroup: "Basketball",
      sportTitle: "NBA",
      commenceTime: at(8),
      home: "Metro Hawks",
      away: "River City",
      completed: false,
      markets: [
        market("h2h", "Match Odds", [
          runner("Metro Hawks", 1.48, "Sample Book"),
          runner("River City", 2.7, "Sample Book"),
        ]),
        market("totals", "Total Points", [
          runner("Over 221.5", 1.9, "Sample Book"),
          runner("Under 221.5", 1.9, "Sample Book"),
        ]),
      ],
    }),
    base({
      id: "sample-cricket-live",
      sportKey: "cricket_international_t20",
      sportGroup: "Cricket",
      sportTitle: "International T20",
      commenceTime: at(-2),
      home: "Blue Caps",
      away: "Red Lions",
      completed: false,
      scores: [
        { name: "Blue Caps", score: "142/4" },
        { name: "Red Lions", score: "0/0" },
      ],
      markets: [
        market("h2h", "Match Odds", [
          runner("Blue Caps", 1.84, "Sample Book"),
          runner("Red Lions", 2.02, "Sample Book"),
        ]),
      ],
    }),
  ];
}

export function sampleEventsFor(sport: string) {
  return getSampleEvents().filter((event) => event.sportKey === sport);
}

export function groupFromKey(sportKey: string): SportGroup | null {
  if (sportKey.startsWith("tennis")) return "Tennis";
  if (sportKey.startsWith("soccer")) return "Soccer";
  if (sportKey.startsWith("basketball")) return "Basketball";
  if (sportKey.startsWith("cricket")) return "Cricket";
  return null;
}
