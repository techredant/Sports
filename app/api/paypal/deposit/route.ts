import { NextRequest } from "next/server";
import { PAYPAL_MAX, PAYPAL_MIN, PAYPAL_SETUP, createDepositOrder, parsePaypalAmount, paypalConfigured } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (!paypalConfigured()) return Response.json({ ok: false, error: PAYPAL_SETUP }, { status: 400, headers });
  const body = await request.json().catch(() => null);
  const amount = parsePaypalAmount((body as { amount?: unknown } | null)?.amount);
  if (amount == null) {
    return Response.json(
      { ok: false, error: `Enter an amount from ${PAYPAL_MIN} to ${PAYPAL_MAX} USD.` },
      { status: 400, headers },
    );
  }
  const origin = request.nextUrl.origin;
  try {
    const result = await createDepositOrder(amount, `${origin}/wallet`, `${origin}/wallet?paypal=cancel`);
    return Response.json(result, { status: result.ok ? 200 : 400, headers });
  } catch {
    return Response.json({ ok: false, error: "PayPal sandbox did not respond." }, { status: 502, headers });
  }
}
