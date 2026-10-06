export const SPORT_GROUPS = ["Soccer", "Cricket", "Tennis"] as const;

export type SportGroup = (typeof SPORT_GROUPS)[number];

export type DataSource = "live" | "sample";

export type League = {
  key: string;
  group: SportGroup;
  title: string;
  active: boolean;
};

export type Runner = {
  name: string;
  back: number;
  lay: number;
  bookmaker: string;
};

export type MarketKey = "h2h" | "totals";

export type Market = {
  key: MarketKey;
  title: string;
  runners: Runner[];
};

export type ScoreLine = {
  name: string;
  score: string;
};

export type MatchEvent = {
  id: string;
  sportKey: string;
  sportGroup: SportGroup;
  sportTitle: string;
  commenceTime: string;
  home: string;
  away: string;
  completed: boolean;
  scores?: ScoreLine[];
  markets: Market[];
  source: DataSource;
};

export type BetSide = "back" | "lay";

export type BetChannel = "matched" | "bookmaker";

export type BetStatus = "open" | "cashed" | "won" | "lost" | "void";

export type Bet = {
  id: string;
  eventId: string;
  sportKey: string;
  sportTitle: string;
  eventLabel: string;
  market: MarketKey;
  channel: BetChannel;
  selection: string;
  side: BetSide;
  odds: number;
  stake: number;
  liability: number;
  includesDraw: boolean;
  status: BetStatus;
  placedAt: string;
  settledAt?: string;
  payout?: number;
};

export type OddsPayload = {
  events: MatchEvent[];
  source: DataSource;
  notice?: string;
};

export type SportsPayload = {
  leagues: League[];
  source: DataSource;
};

export type Scoreboard = {
  id: string;
  completed: boolean;
  scores?: ScoreLine[];
};

export type ScoresPayload = {
  scores: Scoreboard[];
  source: DataSource;
};
