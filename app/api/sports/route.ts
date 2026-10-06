import { SAMPLE_LEAGUES } from "@/lib/mock";
import { getLeagues, OddsQuotaError } from "@/lib/odds";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getLeagues(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (!(error instanceof OddsQuotaError)) throw error;
    return Response.json(
      { leagues: SAMPLE_LEAGUES, source: "sample" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
