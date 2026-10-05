import { MarketScreen } from "@/components/MarketScreen";
import type { BetSide, MarketKey } from "@/lib/types";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sport?: string; market?: string; selection?: string; side?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const market: MarketKey | null = query.market === "totals" || query.market === "h2h" ? query.market : null;
  const side: BetSide | null = query.side === "lay" || query.side === "back" ? query.side : null;
  const initial =
    market && side && query.selection
      ? { market, selection: query.selection, side }
      : null;

  return <MarketScreen eventId={id} sportKey={query.sport ?? ""} initial={initial} />;
}
