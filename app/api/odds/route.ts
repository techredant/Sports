import { NextRequest } from "next/server";
import { getFeatured, getOddsForSport } from "@/lib/odds";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sport = request.nextUrl.searchParams.get("sport");
  const eventId = request.nextUrl.searchParams.get("eventId");
  const featured = request.nextUrl.searchParams.get("featured");

  const payload = featured === "1" || !sport ? await getFeatured() : await getOddsForSport(sport);
  const headers = { "Cache-Control": "no-store" };
  if (!eventId) return Response.json(payload, { headers });
  return Response.json(
    {
      ...payload,
      events: payload.events.filter((event) => event.id === eventId),
    },
    { headers },
  );
}
