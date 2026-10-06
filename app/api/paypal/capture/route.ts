import { NextRequest } from "next/server";
import { PAYPAL_SETUP, captureDeposit, paypalConfigured } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (!paypalConfigured()) return Response.json({ ok: false, error: PAYPAL_SETUP }, { status: 400, headers });
  const body = await request.json().catch(() => null);
  const orderId = (body as { orderId?: unknown } | null)?.orderId;
  if (typeof orderId !== "string") {
    return Response.json({ ok: false, error: "That PayPal order is not valid." }, { status: 400, headers });
  }
  try {
    const result = await captureDeposit(orderId);
    return Response.json(result, { status: result.ok ? 200 : 400, headers });
  } catch {
    return Response.json({ ok: false, error: "PayPal sandbox did not respond." }, { status: 502, headers });
  }
}
