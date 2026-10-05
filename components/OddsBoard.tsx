"use client";

import { formatOdds } from "@/lib/format";
import type { BetChannel, BetSide, Market, MarketKey, Runner } from "@/lib/types";
import type { SlipDraft } from "@/components/BetSlip";
import { BetSlip } from "@/components/BetSlip";
import type { MatchEvent } from "@/lib/types";

function PriceButton({
  label,
  price,
  bookmaker,
  tone,
  selected,
  onClick,
}: {
  label: string;
  price: number;
  bookmaker: string;
  tone: "back" | "lay";
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${label} ${tone} ${formatOdds(price)}`}
      onClick={onClick}
      className={`flex h-12 w-16 shrink-0 flex-col items-center justify-center rounded-sm leading-none sm:w-[4.75rem] ${
        tone === "back" ? "bg-[#b7def6]" : "bg-[#f8c9d4]"
      } ${selected ? "ring-2 ring-black" : ""}`}
    >
      <span className="text-[15px] font-bold">{formatOdds(price)}</span>
      <span className="mt-1 max-w-14 truncate text-[9px] text-black/70 sm:max-w-[4.4rem]">{bookmaker}</span>
    </button>
  );
}

export function OddsBoard({
  event,
  channel,
  draft,
  onPick,
  onDraft,
  onCancel,
  onPlaced,
  showInlineSlip,
}: {
  event: MatchEvent;
  channel: BetChannel;
  draft: SlipDraft | null;
  onPick: (market: MarketKey, runner: Runner, side: BetSide) => void;
  onDraft: (draft: SlipDraft) => void;
  onCancel: () => void;
  onPlaced: () => void;
  showInlineSlip: boolean;
}) {
  return (
    <div>
      {event.markets.map((market) => (
        <MarketBlock
          key={market.key}
          event={event}
          market={market}
          channel={channel}
          draft={draft}
          onPick={onPick}
          onDraft={onDraft}
          onCancel={onCancel}
          onPlaced={onPlaced}
          showInlineSlip={showInlineSlip}
        />
      ))}
    </div>
  );
}

function MarketBlock({
  event,
  market,
  channel,
  draft,
  onPick,
  onDraft,
  onCancel,
  onPlaced,
  showInlineSlip,
}: {
  event: MatchEvent;
  market: Market;
  channel: BetChannel;
  draft: SlipDraft | null;
  onPick: (market: MarketKey, runner: Runner, side: BetSide) => void;
  onDraft: (draft: SlipDraft) => void;
  onCancel: () => void;
  onPlaced: () => void;
  showInlineSlip: boolean;
}) {
  const layHidden = channel === "bookmaker" && market.key === "h2h";

  return (
    <section className="border-b border-[#e4e4e4]">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2 text-xs font-bold text-[#6b6b6b] sm:px-6">
        <span className="text-sm text-black">{market.title}</span>
        <span className="w-16 text-center sm:w-[4.75rem]">BACK</span>
        {layHidden ? <span className="w-16 sm:w-[4.75rem]" /> : <span className="w-16 text-center sm:w-[4.75rem]">LAY</span>}
      </div>
      {market.runners.map((runner) => {
        const open = draft?.market === market.key && draft.selection === runner.name;
        const slipRunner = open ? runner : null;
        return (
          <div key={runner.name} className="border-t border-[#efefef]">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2 sm:px-6">
              <div className="min-w-0">
                <p className="truncate font-semibold">{runner.name}</p>
                <p className="truncate text-xs text-[#0c7a45]">{runner.bookmaker}</p>
              </div>
              <PriceButton
                label={runner.name}
                price={runner.back}
                bookmaker={runner.bookmaker}
                tone="back"
                selected={open && draft?.side === "back"}
                onClick={() => onPick(market.key, runner, "back")}
              />
              {layHidden ? (
                <span className="w-16 sm:w-[4.75rem]" />
              ) : (
                <PriceButton
                  label={runner.name}
                  price={runner.lay}
                  bookmaker={runner.bookmaker}
                  tone="lay"
                  selected={open && draft?.side === "lay"}
                  onClick={() => onPick(market.key, runner, "lay")}
                />
              )}
            </div>
            {showInlineSlip && slipRunner && draft ? (
              <div className="lg:hidden">
                <BetSlip
                  event={event}
                  runner={slipRunner}
                  channel={market.key === "totals" ? "matched" : channel}
                  draft={draft}
                  onChange={onDraft}
                  onCancel={onCancel}
                  onPlaced={onPlaced}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
