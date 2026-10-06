"use client";

import { useEffect, useMemo, useState } from "react";
import { cashOutGross, oppositePrice } from "@/lib/betting";
import { formatMoney, formatOdds, formatWhen } from "@/lib/format";
import type { Bet, MatchEvent, OddsPayload } from "@/lib/types";
import { useWallet } from "@/components/WalletProvider";

type Tab = "matched" | "bookmaker" | "totals";

const TABS: { id: Tab; label: string }[] = [
  { id: "matched", label: "Matched" },
  { id: "bookmaker", label: "Bookmaker" },
  { id: "totals", label: "Fancy" },
];

function averageRows(bets: Bet[]) {
  const groups = new Map<string, { key: string; selection: string; eventLabel: string; stake: number; weighted: number }>();
  for (const bet of bets) {
    const key = `${bet.eventId}|${bet.market}|${bet.selection}|${bet.side}`;
    const current = groups.get(key) ?? {
      key,
      selection: bet.selection,
      eventLabel: bet.eventLabel,
      stake: 0,
      weighted: 0,
    };
    current.stake += bet.stake;
    current.weighted += bet.stake * bet.odds;
    groups.set(key, current);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    odds: group.stake > 0 ? Math.round((group.weighted / group.stake) * 100) / 100 : 0,
  }));
}

function inTab(bet: Bet, tab: Tab) {
  if (tab === "totals") return bet.market === "totals";
  if (tab === "bookmaker") return bet.channel === "bookmaker";
  return bet.market === "h2h" && bet.channel === "matched";
}

export function OpenBets({ openOnly = false }: { openOnly?: boolean }) {
  const { bets, cashOut, settle, reset, ready } = useWallet();
  const [tab, setTab] = useState<Tab>("matched");
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [averageOdds, setAverageOdds] = useState(false);
  const sportKeys = useMemo(
    () => [...new Set(bets.filter((bet) => bet.status === "open").map((bet) => bet.sportKey))],
    [bets],
  );
  const sportKeyList = sportKeys.join(",");

  useEffect(() => {
    if (!sportKeyList) return;
    let cancel = false;
    async function load() {
      const keys = sportKeyList.split(",");
      const payloads = await Promise.all(
        keys.map(async (key) => {
          const response = await fetch(`/api/odds?sport=${encodeURIComponent(key)}`);
          if (!response.ok) return [] as MatchEvent[];
          const payload = (await response.json()) as OddsPayload;
          return payload.events;
        }),
      );
      if (cancel) return;
      const next = payloads.flat();
      setEvents(next);
      settle(next);
    }
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [sportKeyList, settle]);

  const visible = openOnly ? bets.filter((bet) => bet.status === "open") : bets.filter((bet) => inTab(bet, tab));
  const open = visible.filter((bet) => bet.status === "open");
  const settled = openOnly ? [] : visible.filter((bet) => bet.status !== "open");

  function quote(bet: Bet) {
    const event = events.find((item) => item.id === bet.eventId);
    if (!event) return null;
    const price = oppositePrice(event, bet);
    if (price == null) return null;
    return cashOutGross(bet, price);
  }

  function confirmCashOut(bet: Bet, gross: number) {
    const result = cashOut(bet.id, gross);
    setConfirmId(null);
    setMessage(result.ok ? "Bet cashed out." : result.error);
  }

  const averages = averageRows(visible);

  return (
    <div>
      {openOnly ? <h2 className="px-3 pt-4 text-sm font-bold sm:px-6">Open bets</h2> : null}
      {openOnly ? null : (
      <>
      <label className="flex items-center gap-2 px-3 py-3 text-sm font-semibold sm:px-6">
        <input
          type="checkbox"
          checked={averageOdds}
          onChange={(event) => setAverageOdds(event.target.checked)}
        />
        Average Odds
      </label>
      <div className="grid grid-cols-3 text-sm font-bold">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              setConfirmId(null);
            }}
            className={`h-11 ${tab === item.id ? "bg-yellow-300 text-black" : "bg-[#0c7a45] text-white"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      </>
      )}
      {!ready ? <p className="px-3 py-6 text-sm sm:px-6">Loading bets…</p> : null}
      {ready && visible.length === 0 ? (
        <p className="px-3 py-6 text-sm text-[#555]">
          {openOnly
            ? "No open bets."
            : tab === "bookmaker"
            ? "No bookmaker bets yet. Open a match and switch to Bookmaker to back a selection."
            : tab === "totals"
              ? "No fancy bets yet."
              : "No matched bets yet. Back or lay a price on a match."}
        </p>
      ) : null}
      {message ? <p className="px-3 pb-2 text-sm font-semibold text-[#0c7a45]">{message}</p> : null}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      {averageOdds
        ? averages.map((row) => (
            <article key={row.key} className="border-t border-white bg-[#d9eefb] px-3 py-3 sm:px-6">
              <p className="text-[10px] font-bold text-[#666]">Selection</p>
              <p className="font-semibold break-words">{row.selection}</p>
              <p className="text-[11px] text-[#444]">{row.eventLabel}</p>
              <p className="mt-2 text-sm">
                Average odds <span className="font-bold">{formatOdds(row.odds)}</span>
                {" · "}
                Stake <span className="font-bold">{formatMoney(row.stake)}</span>
              </p>
            </article>
          ))
        : null}
      {!averageOdds
        ? [...open, ...settled].map((bet) => {
        const gross = bet.status === "open" ? quote(bet) : null;
        return (
          <article
            key={bet.id}
            className={`relative border-t border-white py-3 pr-3 pl-8 sm:pr-6 ${bet.side === "back" ? "bg-[#d9eefb]" : "bg-[#f8d5df]"}`}
          >
            {bet.status === "open" && gross != null ? (
              <span
              aria-label="Cash out available"
              className="absolute top-2 left-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#0c7a45] text-[10px] font-black text-white"
            >
              C
            </span>
            ) : null}
            <div className="grid grid-cols-2 items-start gap-2 text-sm">
              <div>
                <p className="text-[10px] font-bold text-[#666]">Date/Time</p>
                <time className="text-xs">{formatWhen(bet.placedAt)}</time>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#666]">Selection</p>
                <p className="font-semibold break-words">{bet.selection}</p>
                <p className="text-[11px] break-words text-[#444]">{bet.eventLabel}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#666]">Odds</p>
                <p className="font-semibold">{formatOdds(bet.odds)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#666]">Stake</p>
                <p className="font-semibold">{formatMoney(bet.stake)}</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="uppercase">
                {bet.side} · {bet.status}
                {bet.payout != null && bet.status !== "open"
                  ? ` ${bet.payout > 0 ? "+" : ""}${formatMoney(bet.payout)}`
                  : ""}
              </span>
              {bet.status === "open" && gross == null ? <span>Pricing…</span> : null}
              {bet.status === "open" && gross != null && confirmId !== bet.id ? (
                <button
                  type="button"
                  onClick={() => setConfirmId(bet.id)}
                  className="rounded bg-[#e8831a] px-2 py-1 font-bold text-white"
                >
                  Cash out {formatMoney(gross)}
                </button>
              ) : null}
              {confirmId === bet.id && gross != null ? (
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => confirmCashOut(bet, gross)}
                    className="rounded bg-[#0c7a45] px-2 py-1 font-bold text-white"
                  >
                    Confirm {formatMoney(gross)}
                  </button>
                  <button type="button" onClick={() => setConfirmId(null)} className="underline">
                    Back
                  </button>
                </span>
              ) : null}
            </div>
          </article>
        );
      })
        : null}
      </div>
      {openOnly ? null : (
      <div className="px-3 py-4">
        {resetting ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                reset();
                setResetting(false);
                setMessage("Balance restored.");
              }}
              className="rounded bg-[#e10600] px-3 py-2 text-sm font-bold text-white"
            >
              Confirm reset
            </button>
            <button type="button" onClick={() => setResetting(false)} className="text-sm underline">
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setResetting(true)} className="text-sm text-[#666] underline">
            Reset balance
          </button>
        )}
      </div>
      )}
    </div>
  );
}
