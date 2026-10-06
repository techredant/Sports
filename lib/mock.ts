import { layFromBack } from "@/lib/betting";
import type { League, Market, MatchEvent, Runner, SportGroup } from "@/lib/types";

export const SAMPLE_NOTICE = "";

export const SAMPLE_LEAGUES: League[] = [
  { key: "soccer_india_super_league", group: "Soccer", title: "Indian Super League", active: true },
  { key: "soccer_i_league", group: "Soccer", title: "I-League", active: true },
  { key: "soccer_epl", group: "Soccer", title: "EPL", active: true },
  { key: "soccer_uefa_champs_league", group: "Soccer", title: "UEFA Champions League", active: true },
  { key: "cricket_ipl", group: "Cricket", title: "IPL", active: true },
  { key: "cricket_international_t20", group: "Cricket", title: "International Twenty20", active: true },
  { key: "cricket_odi", group: "Cricket", title: "One Day Internationals", active: true },
  { key: "cricket_test_match", group: "Cricket", title: "Test Matches", active: true },
  { key: "tennis_atp", group: "Tennis", title: "ATP", active: true },
  { key: "tennis_wta", group: "Tennis", title: "WTA", active: true },
];

const BOOK = "Lotus";

function runner(name: string, back: number): Runner {
  return { name, back, lay: layFromBack(back), bookmaker: BOOK };
}

function market(key: Market["key"], title: string, runners: Runner[]): Market {
  return { key, title, runners };
}

type SoccerFixture = {
  id: string;
  key: string;
  title: string;
  hours: number;
  home: string;
  away: string;
  score?: [string, string];
  odds: [number, number, number];
  totals: [number, number];
};

type PairFixture = {
  id: string;
  key: string;
  group: SportGroup;
  title: string;
  hours: number;
  home: string;
  away: string;
  score?: [string, string];
  odds: [number, number];
};

const SOCCER: SoccerFixture[] = [
  { id: "sample-isl-live", key: "soccer_india_super_league", title: "Indian Super League", hours: -0.7, home: "Mohun Bagan", away: "Mumbai City", score: ["1", "0"], odds: [1.72, 3.8, 5.1], totals: [1.95, 1.87] },
  { id: "sample-isl-2", key: "soccer_india_super_league", title: "Indian Super League", hours: -1.4, home: "Bengaluru FC", away: "Kerala Blasters", score: ["2", "1"], odds: [1.9, 3.4, 4.2], totals: [1.88, 1.94] },
  { id: "sample-isl-3", key: "soccer_india_super_league", title: "Indian Super League", hours: 6, home: "FC Goa", away: "Odisha FC", odds: [2.1, 3.3, 3.5], totals: [1.92, 1.9] },
  { id: "sample-isl-4", key: "soccer_india_super_league", title: "Indian Super League", hours: 10, home: "Chennaiyin", away: "East Bengal", odds: [2.55, 3.2, 2.75], totals: [2.02, 1.8] },
  { id: "sample-isl-5", key: "soccer_india_super_league", title: "Indian Super League", hours: 16, home: "Hyderabad FC", away: "Punjab FC", odds: [2.4, 3.25, 2.95], totals: [1.97, 1.85] },
  { id: "sample-isl-6", key: "soccer_india_super_league", title: "Indian Super League", hours: 22, home: "Jamshedpur", away: "Northeast United", odds: [2.2, 3.3, 3.3], totals: [1.9, 1.92] },
  { id: "sample-isl-7", key: "soccer_india_super_league", title: "Indian Super League", hours: 30, home: "Mumbai City", away: "Bengaluru FC", odds: [2.35, 3.4, 2.9], totals: [1.86, 1.96] },
  { id: "sample-isl-8", key: "soccer_india_super_league", title: "Indian Super League", hours: 40, home: "Mohun Bagan", away: "FC Goa", odds: [1.85, 3.5, 4.3], totals: [1.91, 1.91] },
  { id: "sample-ileague-1", key: "soccer_i_league", title: "I-League", hours: -0.5, home: "Mohammedan", away: "Real Kashmir", score: ["0", "0"], odds: [2.3, 3.1, 3.2], totals: [2.1, 1.72] },
  { id: "sample-ileague-2", key: "soccer_i_league", title: "I-League", hours: 8, home: "Gokulam Kerala", away: "Sreenidi Deccan", odds: [2.15, 3.25, 3.4], totals: [1.98, 1.84] },
  { id: "sample-ileague-3", key: "soccer_i_league", title: "I-League", hours: 20, home: "Inter Kashi", away: "Churchill Brothers", odds: [2.6, 3.15, 2.7], totals: [2.05, 1.78] },
  { id: "sample-ileague-4", key: "soccer_i_league", title: "I-League", hours: 36, home: "Namdhari", away: "Aizawl", odds: [1.95, 3.35, 3.9], totals: [1.93, 1.89] },
  { id: "sample-epl-1", key: "soccer_epl", title: "EPL", hours: -1.2, home: "Arsenal", away: "Liverpool", score: ["1", "1"], odds: [2.45, 3.4, 2.85], totals: [1.8, 2.02] },
  { id: "sample-epl-2", key: "soccer_epl", title: "EPL", hours: 5, home: "Manchester City", away: "Chelsea", odds: [1.62, 4, 5.2], totals: [1.74, 2.1] },
  { id: "sample-epl-3", key: "soccer_epl", title: "EPL", hours: 12, home: "Tottenham", away: "Newcastle", odds: [2.2, 3.45, 3.2], totals: [1.88, 1.94] },
  { id: "sample-epl-4", key: "soccer_epl", title: "EPL", hours: 24, home: "Manchester United", away: "Brighton", odds: [1.95, 3.6, 3.8], totals: [1.82, 2] },
  { id: "sample-epl-5", key: "soccer_epl", title: "EPL", hours: 33, home: "Aston Villa", away: "West Ham", odds: [1.78, 3.7, 4.5], totals: [1.85, 1.97] },
  { id: "sample-epl-6", key: "soccer_epl", title: "EPL", hours: 46, home: "Liverpool", away: "Arsenal", odds: [2.05, 3.5, 3.55], totals: [1.77, 2.06] },
  { id: "sample-ucl-1", key: "soccer_uefa_champs_league", title: "UEFA Champions League", hours: -2, home: "Real Madrid", away: "Bayern Munich", score: ["2", "0"], odds: [1.7, 4.1, 4.6], totals: [1.7, 2.15] },
  { id: "sample-ucl-2", key: "soccer_uefa_champs_league", title: "UEFA Champions League", hours: 9, home: "Barcelona", away: "Inter", odds: [1.88, 3.65, 4.1], totals: [1.76, 2.08] },
  { id: "sample-ucl-3", key: "soccer_uefa_champs_league", title: "UEFA Champions League", hours: 28, home: "Paris Saint-Germain", away: "Borussia Dortmund", odds: [1.55, 4.4, 5.6], totals: [1.68, 2.2] },
  { id: "sample-ucl-4", key: "soccer_uefa_champs_league", title: "UEFA Champions League", hours: 44, home: "Atletico Madrid", away: "Juventus", odds: [2.35, 3.15, 3.2], totals: [2.15, 1.7] },
];

const PAIRS: PairFixture[] = [
  { id: "sample-ipl-live", key: "cricket_ipl", group: "Cricket", title: "IPL", hours: -2, home: "Mumbai Indians", away: "Chennai Super Kings", score: ["142/4", "0/0"], odds: [1.84, 2.02] },
  { id: "sample-ipl-2", key: "cricket_ipl", group: "Cricket", title: "IPL", hours: -0.8, home: "Royal Challengers Bengaluru", away: "Kolkata Knight Riders", score: ["88/2", "0/0"], odds: [1.76, 2.12] },
  { id: "sample-ipl-3", key: "cricket_ipl", group: "Cricket", title: "IPL", hours: 7, home: "Gujarat Titans", away: "Rajasthan Royals", odds: [1.91, 1.95] },
  { id: "sample-ipl-4", key: "cricket_ipl", group: "Cricket", title: "IPL", hours: 15, home: "Sunrisers Hyderabad", away: "Delhi Capitals", odds: [1.68, 2.25] },
  { id: "sample-ipl-5", key: "cricket_ipl", group: "Cricket", title: "IPL", hours: 23, home: "Punjab Kings", away: "Lucknow Super Giants", odds: [2.05, 1.82] },
  { id: "sample-ipl-6", key: "cricket_ipl", group: "Cricket", title: "IPL", hours: 31, home: "Chennai Super Kings", away: "Royal Challengers Bengaluru", odds: [1.98, 1.88] },
  { id: "sample-ipl-7", key: "cricket_ipl", group: "Cricket", title: "IPL", hours: 39, home: "Kolkata Knight Riders", away: "Mumbai Indians", odds: [2.15, 1.74] },
  { id: "sample-ipl-8", key: "cricket_ipl", group: "Cricket", title: "IPL", hours: 47, home: "Delhi Capitals", away: "Gujarat Titans", odds: [2.2, 1.7] },
  { id: "sample-t20-1", key: "cricket_international_t20", group: "Cricket", title: "International Twenty20", hours: -1.6, home: "India", away: "West Indies", score: ["96/3", "0/0"], odds: [1.28, 3.8] },
  { id: "sample-t20-2", key: "cricket_international_t20", group: "Cricket", title: "International Twenty20", hours: 18, home: "India", away: "Australia", odds: [1.55, 2.5] },
  { id: "sample-t20-3", key: "cricket_international_t20", group: "Cricket", title: "International Twenty20", hours: 26, home: "England", away: "Pakistan", odds: [1.72, 2.18] },
  { id: "sample-t20-4", key: "cricket_international_t20", group: "Cricket", title: "International Twenty20", hours: 42, home: "South Africa", away: "New Zealand", odds: [1.9, 1.96] },
  { id: "sample-odi-1", key: "cricket_odi", group: "Cricket", title: "One Day Internationals", hours: -3, home: "India", away: "Sri Lanka", score: ["210/4", "0/0"], odds: [1.35, 3.3] },
  { id: "sample-odi-2", key: "cricket_odi", group: "Cricket", title: "One Day Internationals", hours: 21, home: "India", away: "Bangladesh", odds: [1.18, 5.1] },
  { id: "sample-odi-3", key: "cricket_odi", group: "Cricket", title: "One Day Internationals", hours: 45, home: "Australia", away: "England", odds: [1.8, 2.08] },
  { id: "sample-test-1", key: "cricket_test_match", group: "Cricket", title: "Test Matches", hours: -5, home: "India", away: "England", score: ["320/6", "0/0"], odds: [1.48, 2.7] },
  { id: "sample-test-2", key: "cricket_test_match", group: "Cricket", title: "Test Matches", hours: 34, home: "Australia", away: "India", odds: [1.92, 1.94] },
  { id: "sample-tennis-live", key: "tennis_atp", group: "Tennis", title: "ATP", hours: -1, home: "Maya Chen", away: "Lina Costa", score: ["1", "0"], odds: [1.37, 3.4] },
  { id: "sample-atp-2", key: "tennis_atp", group: "Tennis", title: "ATP", hours: 4, home: "Sumit Nagal", away: "Carlos Alcaraz", odds: [6.5, 1.12] },
  { id: "sample-atp-3", key: "tennis_atp", group: "Tennis", title: "ATP", hours: 11, home: "Yuki Bhambri", away: "Jannik Sinner", odds: [7.2, 1.08] },
  { id: "sample-atp-4", key: "tennis_atp", group: "Tennis", title: "ATP", hours: 19, home: "Ramkumar Ramanathan", away: "Novak Djokovic", odds: [8.5, 1.06] },
  { id: "sample-atp-5", key: "tennis_atp", group: "Tennis", title: "ATP", hours: 27, home: "Carlos Alcaraz", away: "Jannik Sinner", odds: [1.85, 1.98] },
  { id: "sample-atp-6", key: "tennis_atp", group: "Tennis", title: "ATP", hours: 41, home: "Novak Djokovic", away: "Alexander Zverev", odds: [1.62, 2.35] },
  { id: "sample-wta-1", key: "tennis_wta", group: "Tennis", title: "WTA", hours: -0.6, home: "Iga Swiatek", away: "Coco Gauff", score: ["1", "0"], odds: [1.45, 2.8] },
  { id: "sample-wta-2", key: "tennis_wta", group: "Tennis", title: "WTA", hours: 8, home: "Aryna Sabalenka", away: "Elena Rybakina", odds: [1.72, 2.15] },
  { id: "sample-wta-3", key: "tennis_wta", group: "Tennis", title: "WTA", hours: 17, home: "Jessica Pegula", away: "Qinwen Zheng", odds: [1.9, 1.92] },
  { id: "sample-wta-4", key: "tennis_wta", group: "Tennis", title: "WTA", hours: 35, home: "Jasmine Paolini", away: "Naomi Osaka", odds: [2.05, 1.8] },
];

function soccerEvent(now: number, fixture: SoccerFixture): MatchEvent {
  return {
    id: fixture.id,
    sportKey: fixture.key,
    sportGroup: "Soccer",
    sportTitle: fixture.title,
    commenceTime: new Date(now + fixture.hours * 60 * 60 * 1000).toISOString(),
    home: fixture.home,
    away: fixture.away,
    completed: false,
    scores: fixture.score
      ? [
          { name: fixture.home, score: fixture.score[0] },
          { name: fixture.away, score: fixture.score[1] },
        ]
      : undefined,
    markets: [
      market("h2h", "Match Odds", [
        runner(fixture.home, fixture.odds[0]),
        runner("Draw", fixture.odds[1]),
        runner(fixture.away, fixture.odds[2]),
      ]),
      market("totals", "Total Goals", [
        runner("Over 2.5", fixture.totals[0]),
        runner("Under 2.5", fixture.totals[1]),
      ]),
    ],
    source: "sample",
  };
}

function pairEvent(now: number, fixture: PairFixture): MatchEvent {
  return {
    id: fixture.id,
    sportKey: fixture.key,
    sportGroup: fixture.group,
    sportTitle: fixture.title,
    commenceTime: new Date(now + fixture.hours * 60 * 60 * 1000).toISOString(),
    home: fixture.home,
    away: fixture.away,
    completed: false,
    scores: fixture.score
      ? [
          { name: fixture.home, score: fixture.score[0] },
          { name: fixture.away, score: fixture.score[1] },
        ]
      : undefined,
    markets: [
      market("h2h", "Match Odds", [runner(fixture.home, fixture.odds[0]), runner(fixture.away, fixture.odds[1])]),
    ],
    source: "sample",
  };
}

export function getSampleEvents(now = Date.now()): MatchEvent[] {
  return [...SOCCER.map((fixture) => soccerEvent(now, fixture)), ...PAIRS.map((fixture) => pairEvent(now, fixture))];
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
