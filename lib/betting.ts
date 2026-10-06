import type { Bet, BetSide, BetStatus, MatchEvent } from "@/lib/types";

export const STARTING_BALANCE = 5000;
export const MIN_STAKE = 10;
export const DEFAULT_QUICK_STAKES = [100, 500, 1000, 5000, 10000, 15000, 20000, 25000];

export type SelectionResult = "hit" | "miss" | "void" | "pending";

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function roundOdds(value: number) {
  return Math.round(value * 100) / 100;
}

export function layFromBack(back: number) {
  return roundOdds(Math.max(1.02, back + 0.01));
}

export function liability(stake: number, odds: number) {
  return roundMoney(stake * (odds - 1));
}

export function exposure(bet: Bet) {
  if (bet.status !== "open") return 0;
  return bet.side === "back" ? bet.stake : bet.liability;
}

export function availableBalance(balance: number, bets: Bet[]) {
  const reserved = bets.reduce((sum, bet) => sum + exposure(bet), 0);
  return roundMoney(balance - reserved);
}

export function maxStake(side: BetSide, odds: number, available: number) {
  if (available <= 0 || odds <= 1) return 0;
  if (side === "back") return Math.floor(available * 100) / 100;
  return Math.floor((available / (odds - 1)) * 100) / 100;
}

export function cashOutGross(bet: Bet, oppositePrice: number) {
  if (oppositePrice <= 1) return 0;
  if (bet.side === "back") {
    return roundMoney(Math.max(0, (bet.stake * bet.odds) / oppositePrice));
  }
  const profit = bet.stake * (1 - bet.odds / oppositePrice);
  return roundMoney(Math.max(0, bet.liability + profit));
}

export function cashOutDelta(bet: Bet, gross: number) {
  const locked = bet.side === "back" ? bet.stake : bet.liability;
  return roundMoney(gross - locked);
}

export function oppositePrice(event: MatchEvent, bet: Bet) {
  const market = event.markets.find((item) => item.key === bet.market);
  const runner = market?.runners.find((item) => item.name === bet.selection);
  if (!runner) return null;
  return bet.side === "back" ? runner.lay : runner.back;
}

function parseTotal(selection: string) {
  const match = selection.match(/^(Over|Under)\s+([0-9]+(?:\.[0-9]+)?)$/i);
  if (!match) return null;
  return {
    side: match[1].toLowerCase() as "over" | "under",
    line: Number(match[2]),
  };
}

export function selectionResult(bet: Bet, event: MatchEvent): SelectionResult {
  if (!event.completed || !event.scores || event.scores.length < 2) return "pending";

  if (bet.market === "totals") {
    if (event.sportGroup !== "Soccer") return "pending";
    const values = event.scores.map((line) => Number(line.score));
    if (values.some((value) => !Number.isFinite(value))) return "pending";
    const total = values.reduce((sum, value) => sum + value, 0);
    const parsed = parseTotal(bet.selection);
    if (!parsed) return "pending";
    if (total === parsed.line) return "void";
    const overHit = total > parsed.line;
    return (parsed.side === "over" ? overHit : !overHit) ? "hit" : "miss";
  }

  const scores = event.scores.map((line) => ({
    name: line.name.trim().toLowerCase(),
    score: Number(line.score),
  }));
  if (scores.some((line) => !Number.isFinite(line.score))) return "pending";
  const best = Math.max(...scores.map((line) => line.score));
  const leaders = scores.filter((line) => line.score === best);
  if (leaders.length !== 1) {
    if (bet.selection === "Draw") return "hit";
    return bet.includesDraw ? "miss" : "void";
  }
  return leaders[0].name === bet.selection.trim().toLowerCase() ? "hit" : "miss";
}

export function betStatusFor(bet: Bet, result: SelectionResult): BetStatus {
  if (result === "pending") return "open";
  if (result === "void") return "void";
  const won = bet.side === "lay" ? result === "miss" : result === "hit";
  return won ? "won" : "lost";
}

export function settlementDelta(bet: Bet, result: SelectionResult) {
  if (result === "void" || result === "pending") return 0;
  if (bet.side === "back") {
    return result === "hit" ? roundMoney(bet.stake * (bet.odds - 1)) : roundMoney(-bet.stake);
  }
  return result === "hit" ? roundMoney(-bet.liability) : roundMoney(bet.stake);
}

export function settleBet(bet: Bet, event: MatchEvent, now = new Date().toISOString()) {
  if (bet.status !== "open") return { bet, delta: 0 };
  const result = selectionResult(bet, event);
  if (result === "pending") return { bet, delta: 0 };
  const delta = settlementDelta(bet, result);
  return {
    bet: {
      ...bet,
      status: betStatusFor(bet, result),
      settledAt: now,
      payout: delta,
    },
    delta,
  };
}
