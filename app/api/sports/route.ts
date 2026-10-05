import { getLeagues } from "@/lib/odds";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getLeagues(), {
    headers: { "Cache-Control": "no-store" },
  });
}
