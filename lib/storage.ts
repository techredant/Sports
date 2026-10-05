import { DEFAULT_QUICK_STAKES, STARTING_BALANCE } from "@/lib/betting";
import type { Bet } from "@/lib/types";

export const WALLET_KEY = "linehouse-wallet-v1";

export type WalletData = {
  balance: number;
  bets: Bet[];
  quickStakes: number[];
  favorites: string[];
};

export function defaultWallet(): WalletData {
  return {
    balance: STARTING_BALANCE,
    bets: [],
    quickStakes: [...DEFAULT_QUICK_STAKES],
    favorites: [],
  };
}

function isBet(value: unknown): value is Bet {
  if (!value || typeof value !== "object") return false;
  const bet = value as Partial<Bet>;
  return (
    typeof bet.id === "string" &&
    typeof bet.eventId === "string" &&
    typeof bet.selection === "string" &&
    (bet.side === "back" || bet.side === "lay") &&
    typeof bet.odds === "number" &&
    typeof bet.stake === "number" &&
    typeof bet.status === "string"
  );
}

export function loadWallet(): WalletData {
  if (typeof window === "undefined") return defaultWallet();
  try {
    const raw = window.localStorage.getItem(WALLET_KEY);
    if (!raw) return defaultWallet();
    const parsed = JSON.parse(raw) as Partial<WalletData>;
    if (typeof parsed.balance !== "number" || !Array.isArray(parsed.bets)) return defaultWallet();
    const quickStakes =
      Array.isArray(parsed.quickStakes) &&
      parsed.quickStakes.length === 8 &&
      parsed.quickStakes.every((stake) => typeof stake === "number" && stake >= 10)
        ? parsed.quickStakes
        : [...DEFAULT_QUICK_STAKES];
    return {
      balance: parsed.balance,
      bets: parsed.bets.filter(isBet),
      quickStakes,
      favorites: Array.isArray(parsed.favorites)
        ? parsed.favorites.filter((id): id is string => typeof id === "string")
        : [],
    };
  } catch {
    return defaultWallet();
  }
}

export function saveWallet(data: WalletData) {
  window.localStorage.setItem(WALLET_KEY, JSON.stringify(data));
}
