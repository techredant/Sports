const SANDBOX = "https://api-m.sandbox.paypal.com";

export const PAYPAL_MIN = 10;
export const PAYPAL_MAX = 1000;
export const PAYPAL_SETUP =
  "Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET from a PayPal sandbox app to .env.local, then restart the dev server. Enable Payouts on that app and fund the sandbox business account.";

type PayPalResult<T> = ({ ok: true } & T) | { ok: false; error: string };

let tokenCache: { value: string; expiresAt: number } | null = null;

function credentials() {
  const id = process.env.PAYPAL_CLIENT_ID?.trim() ?? "";
  const secret = process.env.PAYPAL_CLIENT_SECRET?.trim() ?? "";
  if (!id || !secret) return null;
  return { id, secret };
}

export function paypalConfigured() {
  return credentials() != null;
}

export function paypalClientId() {
  return credentials()?.id ?? null;
}

export function parsePaypalAmount(value: unknown) {
  const amount = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(amount)) return null;
  const rounded = Math.round(amount * 100) / 100;
  if (rounded < PAYPAL_MIN || rounded > PAYPAL_MAX) return null;
  return rounded;
}

function money(amount: number) {
  return amount.toFixed(2);
}

function paypalMessage(body: unknown, fallback: string) {
  if (!body || typeof body !== "object") return fallback;
  const record = body as { message?: string; details?: { description?: string; issue?: string }[] };
  return record.details?.[0]?.description || record.message || fallback;
}

async function accessToken(): Promise<PayPalResult<{ token: string }>> {
  const creds = credentials();
  if (!creds) return { ok: false, error: PAYPAL_SETUP };
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return { ok: true, token: tokenCache.value };
  const response = await fetch(`${SANDBOX}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${creds.id}:${creds.secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const body = await response.json().catch(() => null);
  const token = (body as { access_token?: string; expires_in?: number } | null)?.access_token;
  if (!response.ok || !token) {
    return { ok: false, error: paypalMessage(body, "PayPal sandbox did not accept the login.") };
  }
  const expiresIn = (body as { expires_in?: number }).expires_in ?? 300;
  tokenCache = { value: token, expiresAt: Date.now() + expiresIn * 1000 };
  return { ok: true, token };
}

function sandboxApproveUrl(href: string) {
  try {
    const url = new URL(href);
    return url.protocol === "https:" && (url.hostname === "www.sandbox.paypal.com" || url.hostname === "sandbox.paypal.com");
  } catch {
    return false;
  }
}

export async function createDepositOrder(
  amount: number,
  returnUrl: string,
  cancelUrl: string,
): Promise<PayPalResult<{ orderId: string; approveUrl: string }>> {
  const auth = await accessToken();
  if (!auth.ok) return auth;
  const response = await fetch(`${SANDBOX}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: { currency_code: "USD", value: money(amount) },
          description: "Lotus365 credits",
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "Lotus365",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: returnUrl,
            cancel_url: cancelUrl,
          },
        },
      },
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const body = await response.json().catch(() => null);
  const links = (body as { links?: { rel?: string; href?: string }[] } | null)?.links ?? [];
  const approve = links.find((link) => link.rel === "payer-action" || link.rel === "approve")?.href;
  const orderId = (body as { id?: string } | null)?.id;
  if (!response.ok || !approve || !orderId || !sandboxApproveUrl(approve)) {
    return { ok: false, error: paypalMessage(body, "PayPal sandbox did not return a payment link.") };
  }
  return { ok: true, orderId, approveUrl: approve };
}

export async function captureDeposit(orderId: string): Promise<PayPalResult<{ amount: number; orderId: string }>> {
  if (!/^[A-Za-z0-9]+$/.test(orderId)) return { ok: false, error: "That PayPal order is not valid." };
  const auth = await accessToken();
  if (!auth.ok) return auth;
  const response = await fetch(`${SANDBOX}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) return { ok: false, error: paypalMessage(body, "PayPal sandbox did not capture the deposit.") };
  const status = (body as { status?: string } | null)?.status;
  if (status !== "COMPLETED") return { ok: false, error: "PayPal has not completed this deposit." };
  const captures =
    (
      body as {
        purchase_units?: { payments?: { captures?: { amount?: { currency_code?: string; value?: string }; status?: string }[] } }[];
      } | null
    )?.purchase_units?.[0]?.payments?.captures ?? [];
  const capture = captures.find((item) => item.status === "COMPLETED") ?? captures[0];
  if (capture?.amount?.currency_code !== "USD") return { ok: false, error: "PayPal capture was not in USD." };
  const amount = parsePaypalAmount(capture.amount.value);
  if (amount == null) return { ok: false, error: "PayPal capture amount is outside the demo limit." };
  return { ok: true, amount, orderId };
}

export async function withdrawToPaypal(
  amount: number,
  email: string,
): Promise<PayPalResult<{ amount: number; batchId: string }>> {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { ok: false, error: "Enter a sandbox PayPal email." };
  }
  const auth = await accessToken();
  if (!auth.ok) return auth;
  const response = await fetch(`${SANDBOX}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: `lotus365_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        email_subject: "Lotus365 withdrawal",
        email_message: "Lotus365 withdrawal.",
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: { value: money(amount), currency: "USD" },
          receiver: email,
          note: "Lotus365 withdrawal",
          sender_item_id: `item_${Date.now()}`,
        },
      ],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  const body = await response.json().catch(() => null);
  if (response.status === 403) {
    return { ok: false, error: "Enable Payouts on the PayPal sandbox app, and fund the sandbox business account." };
  }
  const batchId = (body as { batch_header?: { payout_batch_id?: string } } | null)?.batch_header?.payout_batch_id;
  if (response.status !== 201 || !batchId) {
    return { ok: false, error: paypalMessage(body, "PayPal sandbox did not accept the withdrawal.") };
  }
  return { ok: true, amount, batchId };
}
