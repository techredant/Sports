"use client";

import { useEffect, useState } from "react";
import { roundOdds } from "@/lib/betting";
import Link from "next/link";
import { eventStatus, isInPlay, matchScore } from "@/lib/format";
import type { BetChannel, BetSide, MarketKey, MatchEvent, OddsPayload, Runner } from "@/lib/types";
import { BetSlip, type SlipDraft } from "@/components/BetSlip";
import { OddsBoard } from "@/components/OddsBoard";
import { OpenBets } from "@/components/OpenBets";
import { Shell } from "@/components/Shell";
import { useWallet } from "@/components/WalletProvider";

export function MarketScreen({
  eventId,
  sportKey,
  initial,
}: {
  eventId: string;
  sportKey: string;
  initial: { market: MarketKey; selection: string; side: BetSide } | null;
}) {
  const { openCount, settle, favorites, toggleFavorite } = useWallet();
  const [event, setEvent] = useState<MatchEvent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<"market" | "bets">("market");
  const [channel, setChannel] = useState<BetChannel>("matched");
  const [draft, setDraft] = useState<SlipDraft | null>(null);
  const [seededId, setSeededId] = useState<string | null>(null);
  const [placed, setPlaced] = useState<string | null>(null);

  if (event?.id === eventId && seededId !== eventId) {
    setSeededId(eventId);
    const market = initial ? event.markets.find((item) => item.key === initial.market) : undefined;
    const runner = market?.runners.find((item) => item.name === initial?.selection);
    if (runner && initial) {
      const odds = initial.side === "lay" ? runner.lay : runner.back;
      setDraft({
        market: initial.market,
        selection: runner.name,
        side: initial.side,
        odds,
        oddsAtOpen: odds,
        stake: "",
        acceptAny: true,
      });
    } else {
      setDraft(null);
    }
  } else if (event && draft?.acceptAny && seededId === event.id) {
    const market = event.markets.find((item) => item.key === draft.market);
    const runner = market?.runners.find((item) => item.name === draft.selection);
    if (runner) {
      const live = roundOdds(draft.side === "lay" ? runner.lay : runner.back);
      if (live !== roundOdds(draft.odds) || live !== roundOdds(draft.oddsAtOpen)) {
        setDraft({ ...draft, odds: live, oddsAtOpen: live });
      }
    }
  }

  useEffect(() => {
    let cancel = false;
    async function load() {
      const url = sportKey
        ? `/api/odds?sport=${encodeURIComponent(sportKey)}&eventId=${encodeURIComponent(eventId)}`
        : `/api/odds?featured=1`;
      const response = await fetch(url);
      const payload = (await response.json()) as OddsPayload;
      if (cancel) return;
      const next = payload.events.find((item) => item.id === eventId) ?? null;
      setEvent(next);
      setMissing(!next);
      setNotice(payload.notice ?? null);
      setLoading(false);
      if (next) settle([next]);
    }
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [eventId, sportKey, settle]);

  function pick(market: MarketKey, runner: Runner, side: BetSide) {
    setPlaced(null);
    setTab("market");
    if (draft?.market === market && draft.selection === runner.name && draft.side === side) {
      setDraft(null);
      return;
    }
    const odds = side === "lay" ? runner.lay : runner.back;
    setDraft({
      market,
      selection: runner.name,
      side,
      odds,
      oddsAtOpen: odds,
      stake: "",
      acceptAny: true,
    });
  }

  const selectedRunner =
    event && draft
      ? event.markets.find((item) => item.key === draft.market)?.runners.find((item) => item.name === draft.selection)
      : null;
  const score = event ? matchScore(event) : null;

  return (
    <Shell backHref="/">
      <div className="flex flex-wrap items-center gap-2 bg-[#1c1c1c] px-3 py-2 text-white sm:px-6">
        <Link href="/?when=inplay" className="rounded bg-[#0c7a45] px-3 py-1 text-sm font-semibold">
          In-Play
        </Link>
        <Link href="/?focus=search" aria-label="More filters" className="rounded bg-[#333] px-2 py-1 text-sm">
          ▽
        </Link>
      </div>
      <div
        className="mt-3 ml-3 flex h-10 w-[min(18rem,72%)] items-center gap-2 bg-[#128a5a] px-4 font-semibold text-white sm:ml-6"
        style={{ clipPath: "polygon(0 0, 92% 0, 100% 100%, 0 100%)" }}
      >
        <span aria-hidden className="grid grid-cols-2 gap-0.5">
          <span className="h-1.5 w-1.5 bg-white" />
          <span className="h-1.5 w-1.5 bg-white" />
          <span className="h-1.5 w-1.5 bg-white" />
          <span className="h-1.5 w-1.5 bg-white" />
        </span>
        Main Market
      </div>
      <div className="mt-3 grid grid-cols-2 text-sm font-bold text-white">
        <button
          type="button"
          onClick={() => setTab("market")}
          className={`h-11 ${tab === "market" ? "bg-[#0c7a45] shadow-[inset_0_-3px_0_#f5d90a]" : "bg-[#0a6840]"}`}
        >
          MARKET
        </button>
        <button
          type="button"
          onClick={() => setTab("bets")}
          className={`h-11 ${tab === "bets" ? "bg-[#0c7a45] shadow-[inset_0_-3px_0_#f5d90a]" : "bg-[#0a6840]"}`}
        >
          OPEN BETS ({openCount})
        </button>
      </div>
      {tab === "bets" ? (
        <OpenBets />
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_26rem]">
          <div>
            {notice ? <p className="bg-[#fff6d8] px-3 py-2 text-xs text-[#6a5300]">{notice}</p> : null}
            {loading ? <p className="px-3 py-8 text-sm">Loading market…</p> : null}
            {missing ? (
              <p className="px-3 py-8 text-sm">
                This match is not on the board. <Link href="/" className="font-semibold text-[#0c7a45]">Back to matches</Link>
              </p>
            ) : null}
            {event ? (
              <>
                <div className="flex items-start gap-2 px-3 py-3 sm:px-6">
                  <button
                    type="button"
                    aria-label={favorites.includes(event.id) ? "Remove saved match" : "Save match"}
                    aria-pressed={favorites.includes(event.id)}
                    onClick={() => toggleFavorite(event.id)}
                    className="text-lg leading-none text-[#e0a100]"
                  >
                    {favorites.includes(event.id) ? "★" : "☆"}
                  </button>
                  <div className="min-w-0">
                    <p className="font-bold">{event.home} v {event.away}</p>
                    <p className={`text-xs ${isInPlay(event) ? "font-bold text-[#e10600]" : "text-[#666]"}`}>
                      {event.sportTitle} · {eventStatus(event)}
                      {score ? ` · ${score}` : ""}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 text-sm font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setChannel("matched");
                    }}
                    className={`h-10 ${channel === "matched" ? "bg-yellow-300" : "bg-[#0c7a45] text-white"}`}
                  >
                    Exchange
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChannel("bookmaker");
                      if (draft?.market === "h2h" && draft.side === "lay") setDraft(null);
                    }}
                    className={`h-10 ${channel === "bookmaker" ? "bg-yellow-300" : "bg-[#0c7a45] text-white"}`}
                  >
                    Bookmaker
                  </button>
                </div>
                {channel === "bookmaker" ? (
                  <p className="px-3 py-2 text-xs text-[#555] sm:px-6">Bookmaker prices are back only.</p>
                ) : null}
                {placed ? <p className="px-3 py-2 text-sm font-semibold text-[#0c7a45] sm:px-6">{placed}</p> : null}
                <OddsBoard
                  event={event}
                  channel={channel}
                  draft={draft}
                  onPick={pick}
                  onDraft={setDraft}
                  onCancel={() => setDraft(null)}
                  onPlaced={() => {
                    setDraft(null);
                    setPlaced("Bet placed.");
                  }}
                  showInlineSlip
                />
                <WinStrip event={event} onCashout={() => setTab("bets")} />
              </>
            ) : null}
          </div>
          {tab === "market" ? (
            <aside className="sticky top-4 hidden max-h-[calc(100vh-2rem)] overflow-y-auto border-l border-[#e5e5e5] lg:block">
              {event && draft && selectedRunner ? (
                <BetSlip
                  event={event}
                  runner={selectedRunner}
                  channel={draft.market === "totals" ? "matched" : channel}
                  draft={draft}
                  onChange={setDraft}
                  onCancel={() => setDraft(null)}
                  onPlaced={() => {
                    setDraft(null);
                    setPlaced("Bet placed.");
                  }}
                />
              ) : (
                <p className="px-4 py-8 text-sm text-[#666]">Choose a back or lay price.</p>
              )}
            </aside>
          ) : null}
        </div>
      )}
    </Shell>
  );
}

function WinStrip({ event, onCashout }: { event: MatchEvent; onCashout: () => void }) {
  const market = event.markets.find((item) => item.key === "h2h");
  if (!market) return null;
  return (
    <section className="border-t border-[#ececec] px-3 py-3 sm:px-6">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="font-bold">Who Will Win The Match?</h2>
        <button type="button" onClick={onCashout} className="rounded bg-[#e8831a] px-2 py-1 text-xs font-bold text-white">
          CASHOUT
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {market.runners.map((runner) => (
          <div key={runner.name} className="rounded-sm bg-[#d9eefb] px-3 py-2">
            <p className="truncate text-sm font-semibold">{runner.name}</p>
            <p className="text-lg font-bold">{runner.back.toFixed(2)}</p>
            <p className="truncate text-[10px] text-[#555]">{runner.bookmaker}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
