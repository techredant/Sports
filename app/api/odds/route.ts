import { NextRequest } from "next/server";
import { SAMPLE_NOTICE, getSampleEvents, sampleEventsFor } from "@/lib/mock";
import { getFeatured, getOddsForSport, OddsQuotaError } from "@/lib/odds";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sport = request.nextUrl.searchParams.get("sport");
  const eventId = request.nextUrl.searchParams.get("eventId");
  const featured = request.nextUrl.searchParams.get("featured");

  const headers = { "Cache-Control": "no-store" };
  try {
    const payload = featured === "1" || !sport ? await getFeatured() : await getOddsForSport(sport);
    const events = eventId ? payload.events.filter((event) => event.id === eventId) : payload.events;
    return Response.json({ ...payload, events }, { headers });
  } catch (error) {
    if (!(error instanceof OddsQuotaError)) throw error;
    const events = featured === "1" || !sport ? getSampleEvents() : sampleEventsFor(sport);
    return Response.json(
      {
        events: eventId ? events.filter((event) => event.id === eventId) : events,
        source: "sample",
        notice: SAMPLE_NOTICE,
      },
      { headers },
    );
  }
}
