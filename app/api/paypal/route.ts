import { PAYPAL_SETUP, paypalClientId, paypalConfigured } from "@/lib/paypal";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = paypalConfigured();
  return Response.json(
    { configured, clientId: configured ? paypalClientId() : null, notice: configured ? null : PAYPAL_SETUP },
    { headers: { "Cache-Control": "no-store" } },
  );
}
