import { NextRequest } from "next/server";
import { getScores } from "@/lib/odds";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sport = request.nextUrl.searchParams.get("sport");
  if (!sport) {
    return Response.json(
      { scores: [], source: "sample", notice: "Missing sport." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json(await getScores(sport), {
    headers: { "Cache-Control": "no-store" },
  });
}
