"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { eventStatus, isInPlay, isUpcoming, matchScore } from "@/lib/format";
import { formatOdds } from "@/lib/format";
import type { League, MatchEvent, OddsPayload, SportGroup, SportsPayload } from "@/lib/types";
import { SPORT_GROUPS } from "@/lib/types";
import { Shell } from "@/components/Shell";
import { useWallet } from "@/components/WalletProvider";

type When = "inplay" | "upcoming" | "all";
type GroupFilter = "All" | "starred" | SportGroup;

function eventHref(event: MatchEvent, selection?: string) {
  const params = new URLSearchParams({ sport: event.sportKey });
  if (selection) {
    params.set("market", "h2h");
    params.set("selection", selection);
    params.set("side", "back");
  }
  return `/event/${event.id}?${params.toString()}`;
}

export function HomeScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const initialWhen = params.get("when");
  const { favorites, toggleFavorite, settle, openCount } = useWallet();
  const [when, setWhen] = useState<When>(
    initialWhen === "upcoming" || initialWhen === "all" ? initialWhen : "inplay",
  );
  const [group, setGroup] = useState<GroupFilter>("All");
  const [league, setLeague] = useState<string | null>(null);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [filtersOpen, setFiltersOpen] = useState(initialWhen === "upcoming" || initialWhen === "all");
  const searchRef = useRef<HTMLInputElement>(null);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const loadedRef = useRef<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancel = false;
    async function load(initial: boolean) {
      if (initial) setLoading(true);
      else setRefreshing(true);
      try {
        const [sportsResponse, oddsResponse] = await Promise.all([
          fetch("/api/sports"),
          fetch("/api/odds?featured=1"),
        ]);
        if (!sportsResponse.ok || !oddsResponse.ok) {
          if (!cancel) setNotice("Live odds could not be loaded. Refresh the page.");
          return;
        }
        const sports = (await sportsResponse.json()) as SportsPayload;
        const odds = (await oddsResponse.json()) as OddsPayload;
        const featuredKeys = [...new Set(odds.events.map((event) => event.sportKey))];
        const extraKeys = loadedRef.current.filter((key) => !featuredKeys.includes(key));
        const extraPayloads = await Promise.all(
          extraKeys.map(async (key) => {
            const response = await fetch(`/api/odds?sport=${encodeURIComponent(key)}`);
            return (await response.json()) as OddsPayload;
          }),
        );
        if (cancel) return;
        const merged = [...odds.events, ...extraPayloads.flatMap((payload) => payload.events)];
        loadedRef.current = [...new Set([...featuredKeys, ...extraKeys])];
        setLeagues(sports.leagues);
        setEvents(merged);
        if (initial && merged.length > 0 && !merged.some((event) => isInPlay(event))) {
          setWhen("upcoming");
          setFiltersOpen(true);
        }
        setNotice(odds.notice ?? extraPayloads.find((payload) => payload.notice)?.notice ?? null);
        settle(merged);
      } finally {
        if (!cancel) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }
    void load(true);
    const timer = window.setInterval(() => void load(false), 60_000);
    return () => {
      cancel = true;
      window.clearInterval(timer);
    };
  }, [settle]);

  useEffect(() => {
    if (params.get("focus") === "search") searchRef.current?.focus();
  }, [params]);

  async function openLeague(key: string) {
    setLeague(key);
    if (loadedRef.current.includes(key)) return;
    setRefreshing(true);
    try {
      const response = await fetch(`/api/odds?sport=${encodeURIComponent(key)}`);
      const payload = (await response.json()) as OddsPayload;
      loadedRef.current = [...loadedRef.current, key];
      setEvents((current) => [...current.filter((event) => event.sportKey !== key), ...payload.events]);
      if (payload.notice) setNotice(payload.notice);
      settle(payload.events);
    } finally {
      setRefreshing(false);
    }
  }

  const groupLeagues = useMemo(
    () =>
      group === "All" || group === "starred" ? [] : leagues.filter((item) => item.group === group),
    [group, leagues],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events
      .filter((event) => {
        if (group === "starred" && !favorites.includes(event.id)) return false;
        if (group !== "All" && group !== "starred" && event.sportGroup !== group) return false;
        if (league && event.sportKey !== league) return false;
        if (when === "inplay" && !isInPlay(event)) return false;
        if (when === "upcoming" && !isUpcoming(event)) return false;
        if (!needle) return true;
        return `${event.home} ${event.away} ${event.sportTitle}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        const rank = (event: MatchEvent) => (isInPlay(event) ? 0 : event.completed ? 2 : 1);
        const byStatus = rank(a) - rank(b);
        if (byStatus !== 0) return byStatus;
        return new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime();
      });
  }, [events, favorites, group, league, query, when]);

  return (
    <Shell>
      <div className="flex flex-wrap items-center gap-2 bg-[#1c1c1c] px-3 py-2 text-white sm:px-6">
        <button
          type="button"
          onClick={() => setWhen("inplay")}
          className={`rounded px-3 py-1 text-sm font-semibold ${when === "inplay" ? "bg-[#0c7a45]" : "bg-[#333]"}`}
        >
          In-Play
        </button>
        <button
          type="button"
          aria-label="More filters"
          aria-pressed={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
          className={`rounded px-2 py-1 text-sm ${filtersOpen ? "bg-[#0c7a45]" : "bg-[#333]"}`}
        >
          ▽
        </button>
        {filtersOpen
          ? (
              [
                ["upcoming", "Upcoming"],
                ["all", "All"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setWhen(id)}
                className={`rounded px-3 py-1 text-sm font-semibold ${when === id ? "bg-[#0c7a45]" : "bg-[#333]"}`}
              >
                {label}
              </button>
            ))
          : null}
        <button
          type="button"
          onClick={() => router.push("/bets")}
          className="ml-auto text-xs font-semibold text-yellow-300"
        >
          Open bets ({openCount})
        </button>
      </div>
      <div className="border-b border-[#e5e5e5] px-3 py-2 sm:px-6">
        <input
          ref={searchRef}
          id="match-search"
          aria-label="Search players or teams"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search players or teams"
          className="h-10 w-full rounded border border-[#d7d7d7] px-3 text-sm"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto px-3 py-2 sm:flex-wrap sm:overflow-visible sm:px-6">
        <FilterChip active={group === "starred"} onClick={() => { setGroup("starred"); setLeague(null); }}>
          Starred
        </FilterChip>
        <FilterChip active={group === "All"} onClick={() => { setGroup("All"); setLeague(null); }}>
          All
        </FilterChip>
        {SPORT_GROUPS.map((item) => (
          <FilterChip
            key={item}
            active={group === item}
            onClick={() => {
              setGroup(item);
              setLeague(null);
            }}
          >
            {item}
          </FilterChip>
        ))}
      </div>
      {groupLeagues.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto px-3 pb-2 sm:flex-wrap sm:overflow-visible sm:px-6">
          <FilterChip active={league == null} onClick={() => setLeague(null)}>
            All leagues
          </FilterChip>
          {groupLeagues.map((item) => (
            <FilterChip key={item.key} active={league === item.key} onClick={() => void openLeague(item.key)}>
              {item.title}
            </FilterChip>
          ))}
        </div>
      ) : null}
      {notice ? <p className="bg-[#fff6d8] px-3 py-2 text-xs text-[#6a5300] sm:px-6">{notice}</p> : null}
      {refreshing ? <p className="px-3 py-1 text-xs text-[#777] sm:px-6">Refreshing prices…</p> : null}
      {loading ? <p className="px-3 py-8 text-sm sm:px-6">Loading markets…</p> : null}
      {!loading && visible.length === 0 ? (
        <div className="px-3 py-8 text-sm sm:px-6">
          <p>No matches in this view.</p>
          {when === "inplay" ? (
            <button type="button" onClick={() => setWhen("upcoming")} className="mt-2 font-semibold text-[#0c7a45]">
              Show upcoming
            </button>
          ) : null}
        </div>
      ) : null}
      <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((event) => {
          const score = matchScore(event);
          const h2h = event.markets.find((market) => market.key === "h2h");
          return (
            <li key={event.id} className="border-t border-[#ececec] px-3 py-3 sm:border sm:px-4">
              <div className="mb-2 flex items-center gap-2 text-xs">
                <span className="font-bold text-[#0c7a45]">{event.sportTitle}</span>
                <span className={isInPlay(event) ? "font-bold text-[#e10600]" : "text-[#666]"}>
                  {eventStatus(event)}
                  {score ? ` ${score}` : ""}
                </span>
                <button
                  type="button"
                  aria-label={favorites.includes(event.id) ? "Remove saved match" : "Save match"}
                  aria-pressed={favorites.includes(event.id)}
                  onClick={() => toggleFavorite(event.id)}
                  className="ml-auto text-lg leading-none text-[#e0a100]"
                >
                  {favorites.includes(event.id) ? "★" : "☆"}
                </button>
              </div>
              <div className="space-y-1">
                {h2h?.runners.map((runner) => (
                  <button
                    key={runner.name}
                    type="button"
                    onClick={() => router.push(eventHref(event, runner.name))}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <span className="truncate font-semibold">{runner.name}</span>
                    <span className="rounded-sm bg-[#b7def6] px-3 py-1 text-sm font-bold">
                      {formatOdds(runner.back)}
                    </span>
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </Shell>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
        active ? "bg-[#0c7a45] text-white" : "bg-[#efefef] text-[#333]"
      }`}
    >
      {children}
    </button>
  );
}
