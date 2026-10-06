"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import {
  availableBalance,
  cashOutDelta,
  liability,
  MIN_STAKE,
  roundMoney,
  roundOdds,
  settleBet,
} from "@/lib/betting";
import { defaultWallet, loadWallet, saveWallet, type WalletData } from "@/lib/storage";
import type { Bet, BetChannel, BetSide, MarketKey, MatchEvent } from "@/lib/types";

export type PlaceBetInput = {
  event: MatchEvent;
  market: MarketKey;
  selection: string;
  side: BetSide;
  odds: number;
  oddsAtOpen: number;
  currentOdds: number;
  stake: number;
  acceptAny: boolean;
  channel: BetChannel;
};

type Result = { ok: true } | { ok: false; error: string };

type State = WalletData & { ready: boolean };

type Action = { type: "hydrate" | "replace"; data: WalletData } | { type: "reset" };

function reducer(state: State, action: Action): State {
  if (action.type === "reset") return { ...defaultWallet(), ready: true };
  return { ...action.data, ready: true };
}

type WalletApi = {
  ready: boolean;
  balance: number;
  bets: Bet[];
  quickStakes: number[];
  favorites: string[];
  available: number;
  openCount: number;
  placeBet: (input: PlaceBetInput) => Result;
  cashOut: (betId: string, gross: number) => Result;
  credit: (amount: number) => Result;
  withdraw: (amount: number) => Result;
  settle: (events: MatchEvent[]) => void;
  setQuickStakes: (stakes: number[]) => Result;
  toggleFavorite: (eventId: string) => void;
  reset: () => void;
};

const WalletContext = createContext<WalletApi | null>(null);

function toData(state: State): WalletData {
  return {
    balance: state.balance,
    bets: state.bets,
    quickStakes: state.quickStakes,
    favorites: state.favorites,
  };
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { ...defaultWallet(), ready: false });
  const stateRef = useRef(state);

  const commit = useCallback((data: WalletData) => {
    stateRef.current = { ...data, ready: true };
    dispatch({ type: "replace", data });
  }, []);

  useEffect(() => {
    const data = loadWallet();
    stateRef.current = { ...data, ready: true };
    dispatch({ type: "hydrate", data });
  }, []);

  useEffect(() => {
    if (!state.ready) return;
    saveWallet(toData(state));
  }, [state]);

  const placeBet = useCallback(
    (input: PlaceBetInput): Result => {
      const current = stateRef.current;
      if (!current.ready) return { ok: false, error: "Wallet is still loading." };
      const stake = roundMoney(input.stake);
      if (!Number.isFinite(stake) || stake < MIN_STAKE) {
        return { ok: false, error: `Enter a stake of at least ${MIN_STAKE}.` };
      }
      const live = roundOdds(input.currentOdds);
      const requested = roundOdds(input.odds);
      if (live < 1.01) return { ok: false, error: "That price is unavailable." };
      if (!input.acceptAny && requested !== live) {
        const moved = roundOdds(input.oddsAtOpen) !== live;
        return {
          ok: false,
          error: moved
            ? "Odds changed since you opened this bet."
            : "That price is not available. Match the current price or accept any odds.",
        };
      }
      const odds = input.acceptAny ? live : requested;
      const side: BetSide = input.channel === "bookmaker" ? "back" : input.side;
      const data = toData(current);
      const available = availableBalance(data.balance, data.bets);
      const lock = side === "back" ? stake : liability(stake, odds);
      if (lock - available > 0.001) return { ok: false, error: "Not enough available balance." };

      const market = input.event.markets.find((item) => item.key === input.market);
      let bet: Bet = {
        id: crypto.randomUUID(),
        eventId: input.event.id,
        sportKey: input.event.sportKey,
        sportTitle: input.event.sportTitle,
        eventLabel: `${input.event.home} v ${input.event.away}`,
        market: input.market,
        channel: input.channel,
        selection: input.selection,
        side,
        odds,
        stake,
        liability: liability(stake, odds),
        includesDraw: Boolean(market?.runners.some((runner) => runner.name === "Draw")),
        status: "open",
        placedAt: new Date().toISOString(),
      };
      let balance = data.balance;
      if (input.event.completed) {
        const settled = settleBet(bet, input.event);
        bet = settled.bet;
        balance = roundMoney(balance + settled.delta);
      }
      commit({ ...data, balance, bets: [bet, ...data.bets] });
      return { ok: true };
    },
    [commit],
  );

  const credit = useCallback(
    (amount: number): Result => {
      const current = stateRef.current;
      if (!current.ready) return { ok: false, error: "Wallet is still loading." };
      const credits = roundMoney(amount);
      if (!Number.isFinite(credits) || credits < MIN_STAKE || credits > 1000) {
        return { ok: false, error: "Deposit must be from 10 to 1,000." };
      }
      const data = toData(current);
      commit({ ...data, balance: roundMoney(data.balance + credits) });
      return { ok: true };
    },
    [commit],
  );

  const withdraw = useCallback(
    (amount: number): Result => {
      const current = stateRef.current;
      if (!current.ready) return { ok: false, error: "Wallet is still loading." };
      const payout = roundMoney(amount);
      if (!Number.isFinite(payout) || payout < MIN_STAKE || payout > 1000) {
        return { ok: false, error: "Withdrawal must be from 10 to 1,000." };
      }
      const data = toData(current);
      const available = availableBalance(data.balance, data.bets);
      if (payout - available > 0.001) return { ok: false, error: "Not enough available balance." };
      commit({ ...data, balance: roundMoney(data.balance - payout) });
      return { ok: true };
    },
    [commit],
  );

  const cashOut = useCallback(
    (betId: string, gross: number): Result => {
      const current = stateRef.current;
      const data = toData(current);
      const bet = data.bets.find((item) => item.id === betId && item.status === "open");
      if (!bet) return { ok: false, error: "That bet is no longer open." };
      if (!Number.isFinite(gross) || gross < 0) return { ok: false, error: "Cash out is unavailable." };
      const delta = cashOutDelta(bet, roundMoney(gross));
      commit({
        ...data,
        balance: roundMoney(data.balance + delta),
        bets: data.bets.map((item) =>
          item.id === betId
            ? { ...item, status: "cashed", settledAt: new Date().toISOString(), payout: delta }
            : item,
        ),
      });
      return { ok: true };
    },
    [commit],
  );

  const settle = useCallback(
    (events: MatchEvent[]) => {
      const current = stateRef.current;
      if (!current.ready || events.length === 0) return;
      const data = toData(current);
      const byId = new Map(events.map((event) => [event.id, event]));
      let balance = data.balance;
      let changed = false;
      const bets = data.bets.map((bet) => {
        if (bet.status !== "open") return bet;
        const event = byId.get(bet.eventId);
        if (!event) return bet;
        const settled = settleBet(bet, event);
        if (settled.bet === bet) return bet;
        changed = true;
        balance = roundMoney(balance + settled.delta);
        return settled.bet;
      });
      if (changed) commit({ ...data, balance, bets });
    },
    [commit],
  );

  const setQuickStakes = useCallback(
    (stakes: number[]): Result => {
      if (stakes.length !== 8 || stakes.some((stake) => !Number.isFinite(stake) || stake < MIN_STAKE)) {
        return { ok: false, error: `Each quick stake must be at least ${MIN_STAKE}.` };
      }
      const current = toData(stateRef.current);
      commit({ ...current, quickStakes: stakes.map((stake) => roundMoney(stake)) });
      return { ok: true };
    },
    [commit],
  );

  const toggleFavorite = useCallback(
    (eventId: string) => {
      const current = toData(stateRef.current);
      const favorites = current.favorites.includes(eventId)
        ? current.favorites.filter((id) => id !== eventId)
        : [...current.favorites, eventId];
      commit({ ...current, favorites });
    },
    [commit],
  );

  const reset = useCallback(() => {
    const data = defaultWallet();
    stateRef.current = { ...data, ready: true };
    dispatch({ type: "reset" });
  }, []);

  const api = useMemo<WalletApi>(
    () => ({
      ready: state.ready,
      balance: state.balance,
      bets: state.bets,
      quickStakes: state.quickStakes,
      favorites: state.favorites,
      available: availableBalance(state.balance, state.bets),
      openCount: state.bets.filter((bet) => bet.status === "open").length,
      placeBet,
      cashOut,
      credit,
      withdraw,
      settle,
      setQuickStakes,
      toggleFavorite,
      reset,
    }),
    [state, placeBet, cashOut, credit, withdraw, settle, setQuickStakes, toggleFavorite, reset],
  );

  return <WalletContext.Provider value={api}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const wallet = useContext(WalletContext);
  if (!wallet) throw new Error("useWallet must be used within WalletProvider");
  return wallet;
}
