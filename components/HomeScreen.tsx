"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { eventStatus, isInPlay, isUpcoming, matchScore } from "@/lib/format";
import { formatOdds } from "@/lib/format";
import type { League, MatchEvent, OddsPayload, SportGroup, SportsPayload } from "@/lib/types";
import { SPORT_GROUPS } from "@/lib/types";
import { OpenBets } from "@/components/OpenBets";
import { Shell } from "@/components/Shell";
import { useWallet } from "@/components/WalletProvider";
import { involvesIndia } from "@/lib/odds";

type When = "inplay" | "upcoming";
type BoardTab = "live" | "upcoming" | "open";
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
  const [when, setWhen] = useState<When>(initialWhen === "upcoming" ? "upcoming" : "inplay");
  const [filtersOpen, setFiltersOpen] = useState(initialWhen === "upcoming");
  const [board, setBoard] = useState<BoardTab>("live");
  const [group, setGroup] = useState<GroupFilter>("All");
  const [league, setLeague] = useState<string | null>(null);
  const [query, setQuery] = useState(params.get("q") ?? "");
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
        const time = group === "All" ? board : when;
        if ((time === "inplay" || time === "live") && !isInPlay(event)) return false;
        if (time === "upcoming" && !isUpcoming(event)) return false;
        if (!needle) return true;
        return `${event.home} ${event.away} ${event.sportTitle}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        const india = Number(involvesIndia(b)) - Number(involvesIndia(a));
        if (india !== 0) return india;
        const rank = (event: MatchEvent) => (isInPlay(event) ? 0 : event.completed ? 2 : 1);
        const byStatus = rank(a) - rank(b);
        if (byStatus !== 0) return byStatus;
        return new Date(a.commenceTime).getTime() - new Date(b.commenceTime).getTime();
      });
  }, [board, events, favorites, group, league, query, when]);

  function renderMatch(event: MatchEvent) {
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
              <span className="rounded-sm bg-[#b7def6] px-3 py-1 text-sm font-bold">{formatOdds(runner.back)}</span>
            </button>
          ))}
        </div>
      </li>
    );
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-center gap-2 bg-[#1c1c1c] px-3 py-2 text-white sm:px-6">
        <button
          type="button"
          onClick={() => {
            setWhen("inplay");
            setBoard("live");
          }}
          className={`rounded px-3 py-1 text-sm font-semibold ${(group === "All" ? board === "live" : when === "inplay") ? "bg-[#0c7a45]" : "bg-[#333]"}`}
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
        {filtersOpen ? (
          <button
            type="button"
            onClick={() => {
              setWhen("upcoming");
              setBoard("upcoming");
            }}
            className={`rounded px-3 py-1 text-sm font-semibold ${(group === "All" ? board === "upcoming" : when === "upcoming") ? "bg-[#0c7a45]" : "bg-[#333]"}`}
          >
            Upcoming
          </button>
        ) : null}
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
      <div className="flex flex-wrap gap-2 px-3 py-2 sm:px-6">
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
      {group === "All" ? (
        <div className="flex flex-wrap gap-2 border-b border-[#e5e5e5] px-3 py-2 sm:px-6">
          <button
            type="button"
            onClick={() => {
              setBoard("live");
              setWhen("inplay");
            }}
            className={`shrink-0 rounded px-3 py-1 text-sm font-semibold ${board === "live" ? "bg-[#0c7a45] text-white" : "bg-[#efefef] text-[#333]"}`}
          >
            Live
          </button>
          <button
            type="button"
            onClick={() => {
              setBoard("upcoming");
              setWhen("upcoming");
              setFiltersOpen(true);
            }}
            className={`shrink-0 rounded px-3 py-1 text-sm font-semibold ${board === "upcoming" ? "bg-[#0c7a45] text-white" : "bg-[#efefef] text-[#333]"}`}
          >
            Upcoming
          </button>
          <button
            type="button"
            onClick={() => setBoard("open")}
            className={`shrink-0 rounded px-3 py-1 text-sm font-semibold ${board === "open" ? "bg-[#0c7a45] text-white" : "bg-[#efefef] text-[#333]"}`}
          >
            Open bets ({openCount})
          </button>
        </div>
      ) : null}
      {groupLeagues.length > 0 ? (
        <div
          className={
            group === "Soccer"
              ? "flex flex-col gap-2 px-3 pb-2 sm:flex-row sm:flex-wrap sm:px-6"
              : "flex gap-2 overflow-x-auto px-3 pb-2 sm:flex-wrap sm:overflow-visible sm:px-6"
          }
        >
          <FilterChip wide={group === "Soccer"} active={league == null} onClick={() => setLeague(null)}>
            All leagues
          </FilterChip>
          {groupLeagues.map((item) => (
            <FilterChip
              key={item.key}
              wide={group === "Soccer"}
              active={league === item.key}
              onClick={() => void openLeague(item.key)}
            >
              {item.title}
            </FilterChip>
          ))}
        </div>
      ) : null}
      {notice ? <p className="bg-[#fff6d8] px-3 py-2 text-xs text-[#6a5300] sm:px-6">{notice}</p> : null}
      {refreshing ? <p className="px-3 py-1 text-xs text-[#777] sm:px-6">Refreshing prices…</p> : null}
      {loading ? <p className="px-3 py-8 text-sm sm:px-6">Loading markets…</p> : null}
      {!loading && !(group === "All" && board === "open") && visible.length === 0 ? (
        <div className="px-3 py-8 text-sm sm:px-6">
          <p>
            {(group === "All" ? board === "upcoming" : when === "upcoming")
              ? "No upcoming matches."
              : "No live matches."}
          </p>
          {when === "inplay" && group !== "All" ? (
            <button
              type="button"
              onClick={() => {
                setFiltersOpen(true);
                setWhen("upcoming");
              }}
              className="mt-2 font-semibold text-[#0c7a45]"
            >
              Show upcoming
            </button>
          ) : null}
        </div>
      ) : null}
      {!loading && group === "All" && board === "open" ? <OpenBets openOnly /> : null}
      {!loading && !(group === "All" && board === "open") && visible.length > 0 ? (
      <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((event) => renderMatch(event))}
      </ul>
      ) : null}
    </Shell>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  wide = false,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${
        wide ? "w-full rounded-md text-left sm:w-auto sm:shrink-0 sm:rounded-full sm:text-center" : "shrink-0 rounded-full"
      } px-3 py-1 text-sm font-semibold ${active ? "bg-[#0c7a45] text-white" : "bg-[#efefef] text-[#333]"}`}
    >
      {children}
    </button>
  );
}
