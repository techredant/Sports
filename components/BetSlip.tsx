"use client";

import { useState } from "react";
import { formatMoney, formatOdds } from "@/lib/format";
import { liability, maxStake, MIN_STAKE, roundMoney, roundOdds } from "@/lib/betting";
import type { BetChannel, MarketKey, MatchEvent, Runner } from "@/lib/types";
import { useWallet, type PlaceBetInput } from "@/components/WalletProvider";

export type SlipDraft = {
  market: MarketKey;
  selection: string;
  side: "back" | "lay";
  odds: number;
  oddsAtOpen: number;
  stake: string;
  acceptAny: boolean;
};

export function BetSlip({
  event,
  runner,
  channel,
  draft,
  onChange,
  onCancel,
  onPlaced,
}: {
  event: MatchEvent;
  runner: Runner;
  channel: BetChannel;
  draft: SlipDraft;
  onChange: (draft: SlipDraft) => void;
  onCancel: () => void;
  onPlaced: () => void;
}) {
  const { available, quickStakes, setQuickStakes, placeBet, ready } = useWallet();
  const [editor, setEditor] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const live = draft.side === "lay" ? runner.lay : runner.back;
  const fillOdds = draft.acceptAny ? live : draft.odds;
  const stakeValue = Number(draft.stake);
  const stake = Number.isFinite(stakeValue) ? stakeValue : 0;
  const ceiling = maxStake(draft.side, fillOdds, available);
  const canPlace = ready && stake >= MIN_STAKE && stake <= ceiling + 0.001;

  function setStake(value: string) {
    setError(null);
    onChange({ ...draft, stake: value });
  }

  function addStake(amount: number) {
    const next = Math.min(ceiling, roundMoney((stake || 0) + amount));
    setStake(next > 0 ? String(next) : "");
  }

  function saveStakes() {
    if (!editor) return;
    const stakes = editor.map((value) => Number(value));
    const result = setQuickStakes(stakes);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditor(null);
    setError(null);
  }

  function submit() {
    const input: PlaceBetInput = {
      event,
      market: draft.market,
      selection: draft.selection,
      side: draft.side,
      odds: draft.odds,
      oddsAtOpen: draft.oddsAtOpen,
      currentOdds: live,
      stake,
      acceptAny: draft.acceptAny,
      channel,
    };
    const result = placeBet(input);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onPlaced();
  }

  return (
    <div className="bg-[#d5eef8] px-3 py-3">
      <p className="mb-2 text-xs font-bold tracking-wide text-[#24556d] uppercase">
        {draft.side} {draft.selection}
        {channel === "bookmaker" ? " · Bookmaker" : ""}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm">
        <button
          type="button"
          aria-pressed={draft.acceptAny}
          onClick={() =>
            onChange({
              ...draft,
              acceptAny: !draft.acceptAny,
              odds: live,
              oddsAtOpen: live,
            })
          }
          className="flex items-center gap-2 font-semibold"
        >
          <span
            className={`relative h-6 w-11 rounded-full ${draft.acceptAny ? "bg-[#0c7a45]" : "bg-neutral-400"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${draft.acceptAny ? "translate-x-5" : "translate-x-0.5"}`}
            />
          </span>
          Accept any odds
        </button>
        <span className="font-semibold">
          Aval Bal : {formatMoney(available)}
        </span>
      </div>

      <div className="mt-3 flex flex-col gap-2 min-[420px]:flex-row">
        <div className="flex h-11 overflow-hidden rounded bg-black text-white">
          <button
            type="button"
            aria-label="Decrease odds"
            disabled={draft.acceptAny}
            onClick={() => onChange({ ...draft, odds: roundOdds(Math.max(1.01, draft.odds - 0.01)) })}
            className="w-10 text-xl disabled:opacity-40"
          >
            −
          </button>
          <div className="flex w-16 items-center justify-center font-bold">{formatOdds(draft.odds)}</div>
          <button
            type="button"
            aria-label="Increase odds"
            disabled={draft.acceptAny}
            onClick={() => onChange({ ...draft, odds: roundOdds(draft.odds + 0.01) })}
            className="w-10 text-xl disabled:opacity-40"
          >
            +
          </button>
        </div>
        <input
          aria-label="Stake"
          inputMode="decimal"
          value={draft.stake}
          placeholder="0"
          onChange={(event) => {
            const value = event.target.value;
            if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) setStake(value);
          }}
          className="h-11 min-w-0 flex-1 rounded border border-[#9ec3d6] bg-white px-3 text-right text-lg font-semibold"
        />
      </div>
      <p className="mt-2 text-xs text-[#24556d]">
        {draft.acceptAny
          ? `Places at the current price ${formatOdds(live)}.`
          : `Places only at ${formatOdds(draft.odds)}. Current price is ${formatOdds(live)}.`}
        {stake >= MIN_STAKE
          ? draft.side === "back"
            ? ` Profit ${formatMoney(stake * (fillOdds - 1))}.`
            : ` Liability ${formatMoney(liability(stake, fillOdds))}. You win the stake if the selection loses.`
          : ""}
      </p>

      {editor ? (
        <div className="mt-3">
          <div className="grid grid-cols-4 gap-2">
            {editor.map((value, index) => (
              <input
                key={index}
                aria-label={`Quick stake ${index + 1}`}
                inputMode="decimal"
                value={value}
                onChange={(event) =>
                  setEditor((current) =>
                    current
                      ? current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item))
                      : current,
                  )
                }
                className="h-10 rounded border border-[#9ec3d6] bg-white text-center font-semibold"
              />
            ))}
          </div>
          <button
            type="button"
            onClick={saveStakes}
            className="mt-2 h-10 w-full rounded bg-[#0e7a48] font-bold text-white"
          >
            Save stakes
          </button>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {quickStakes.map((amount, index) => (
            <button
              key={`${index}-${amount}`}
              type="button"
              disabled={amount > ceiling + 0.001}
              onClick={() => addStake(amount)}
              className="h-10 rounded bg-[#0e7a48] text-sm font-bold text-white disabled:bg-[#8f8f8f]"
            >
              {amount}
            </button>
          ))}
        </div>
      )}

      <div className="mt-2 grid grid-cols-4 gap-2 text-sm font-bold text-white">
        <button
          type="button"
          onClick={() => setStake(ceiling >= MIN_STAKE ? String(MIN_STAKE) : "")}
          className="h-10 rounded bg-[#1f9d55]"
        >
          MIN
        </button>
        <button
          type="button"
          onClick={() => setStake(ceiling >= MIN_STAKE ? String(ceiling) : "")}
          className="h-10 rounded bg-[#2a2768]"
        >
          MAX
        </button>
        <button type="button" onClick={() => setStake("")} className="h-10 rounded bg-[#e10600]">
          CLEAR
        </button>
        <button
          type="button"
          onClick={() => setEditor(quickStakes.map(String))}
          className="h-10 rounded bg-[#0e7a48] text-xs"
        >
          EDIT STAKE
        </button>
      </div>

      {error ? <p className="mt-2 text-sm font-semibold text-[#e10600]">{error}</p> : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 rounded border-2 border-[#2f6f9f] bg-[#d7ecf8] font-semibold text-[#1d4e73]"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!canPlace}
          onClick={submit}
          className="h-11 rounded bg-[#0c7a45] font-bold text-white disabled:bg-[#c8c8c8] disabled:text-[#6b6b6b]"
        >
          Place Bet
        </button>
      </div>
    </div>
  );
}
