import { NextRequest } from "next/server";
import { getScores, OddsQuotaError } from "@/lib/odds";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sport = request.nextUrl.searchParams.get("sport");
  if (!sport) {
    return Response.json(
      { scores: [], source: "sample", notice: "Missing sport." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    return Response.json(await getScores(sport), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (!(error instanceof OddsQuotaError)) throw error;
    return Response.json(
      { scores: [], source: "sample" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
