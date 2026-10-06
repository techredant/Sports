"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Shell } from "@/components/Shell";
import { useWallet } from "@/components/WalletProvider";
import { formatMoney } from "@/lib/format";

const MIN = 10;
const MAX = 1000;

function amountValue(raw: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const amount = Math.round(Number(raw) * 100) / 100;
  if (amount < MIN || amount > MAX) return null;
  return amount;
}

const creditedOrders = new Set<string>();
const captureRequests = new Map<string, Promise<{ ok?: boolean; amount?: number; error?: string }>>();

function captureOrder(orderId: string) {
  const existing = captureRequests.get(orderId);
  if (existing) return existing;
  const request = fetch("/api/paypal/capture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  }).then(async (response) => (await response.json()) as { ok?: boolean; amount?: number; error?: string });
  captureRequests.set(orderId, request);
  return request;
}

type PaypalButtons = {
  render: (target: HTMLElement) => Promise<void>;
  close: () => Promise<void>;
};

type PaypalSdk = {
  Buttons: (options: {
    createOrder: () => Promise<string>;
    onApprove: (data: { orderID: string }) => Promise<void>;
    onCancel: () => void;
    onError: (error: unknown) => void;
  }) => PaypalButtons;
};

function paypalSdk() {
  return (window as Window & { paypal?: PaypalSdk }).paypal;
}

function loadPaypalSdk(clientId: string) {
  if (paypalSdk()) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("PayPal checkout did not load."));
    document.head.appendChild(script);
  });
}

export function WalletScreen() {
  const params = useSearchParams();
  const { ready, available, credit, withdraw } = useWallet();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("10");
  const [withdrawAmount, setWithdrawAmount] = useState("10");
  const [email, setEmail] = useState("");
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [busy, setBusy] = useState(false);
  const depositRef = useRef(depositAmount);
  const buttonHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    depositRef.current = depositAmount;
  }, [depositAmount]);

  useEffect(() => {
    let cancel = false;
    async function load() {
      const response = await fetch("/api/paypal");
      const payload = (await response.json()) as { configured?: boolean; clientId?: string | null; notice?: string | null };
      if (cancel) return;
      setConfigured(Boolean(payload.configured));
      setClientId(payload.clientId ?? null);
      setNotice(payload.notice ?? null);
    }
    void load();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (params.get("paypal") === "cancel") setMessage("PayPal deposit was cancelled.");
  }, [params]);

  useEffect(() => {
    const token = params.get("token");
    if (!token || !ready) return;
    const orderId = token;
    const storageKey = `paypal-order:${orderId}`;
    if (window.sessionStorage.getItem(storageKey) === "done" || creditedOrders.has(orderId)) return;
    let cancel = false;
    async function capture() {
      setBusy(true);
      setError(null);
      try {
        const payload = await captureOrder(orderId);
        if (cancel || creditedOrders.has(orderId) || window.sessionStorage.getItem(storageKey) === "done") return;
        if (!payload.ok || payload.amount == null) {
          setError(payload.error ?? "PayPal sandbox did not capture the deposit.");
          return;
        }
        creditedOrders.add(orderId);
        window.sessionStorage.setItem(storageKey, "done");
        const result = credit(payload.amount);
        if (!result.ok) {
          creditedOrders.delete(orderId);
          window.sessionStorage.removeItem(storageKey);
          setError(result.error);
          return;
        }
        setMessage(`Added ${formatMoney(payload.amount)} credits.`);
      } catch {
        if (!cancel) setError("PayPal sandbox did not respond.");
      } finally {
        if (!cancel) setBusy(false);
      }
    }
    void capture();
    return () => {
      cancel = true;
    };
  }, [params, ready, credit]);

  useEffect(() => {
    const host = buttonHost.current;
    if (!clientId || !host) return;
    let cancel = false;
    let buttons: PaypalButtons | null = null;
    async function mount() {
      try {
        await loadPaypalSdk(clientId as string);
        const sdk = paypalSdk();
        if (cancel || !host || !sdk) return;
        host.replaceChildren();
        buttons = sdk.Buttons({
          createOrder: async () => {
            const amount = amountValue(depositRef.current);
            if (amount == null) throw new Error(`Enter a deposit from ${MIN} to ${MAX}.`);
            const response = await fetch("/api/paypal/deposit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ amount }),
            });
            const payload = (await response.json()) as { ok?: boolean; orderId?: string; error?: string };
            if (!payload.ok || !payload.orderId) throw new Error(payload.error ?? "PayPal sandbox did not start checkout.");
            return payload.orderId;
          },
          onApprove: async (data) => {
            setBusy(true);
            setError(null);
            try {
              const payload = await captureOrder(data.orderID);
              const storageKey = `paypal-order:${data.orderID}`;
              if (creditedOrders.has(data.orderID) || window.sessionStorage.getItem(storageKey) === "done") return;
              if (!payload.ok || payload.amount == null) {
                setError(payload.error ?? "PayPal sandbox did not capture the deposit.");
                return;
              }
              creditedOrders.add(data.orderID);
              window.sessionStorage.setItem(storageKey, "done");
              const result = credit(payload.amount);
              if (!result.ok) {
                creditedOrders.delete(data.orderID);
                window.sessionStorage.removeItem(storageKey);
                setError(result.error);
                return;
              }
              setMessage(`Added ${formatMoney(payload.amount)} credits.`);
            } catch {
              setError("PayPal sandbox did not respond.");
            } finally {
              setBusy(false);
            }
          },
          onCancel: () => setMessage("PayPal deposit was cancelled."),
          onError: (checkoutError) => {
            setError(checkoutError instanceof Error ? checkoutError.message : "PayPal checkout did not open.");
          },
        });
        await buttons.render(host);
      } catch (checkoutError) {
        if (!cancel) setError(checkoutError instanceof Error ? checkoutError.message : "PayPal checkout did not load.");
      }
    }
    void mount();
    return () => {
      cancel = true;
      void buttons?.close().catch(() => undefined);
      host.replaceChildren();
    };
  }, [clientId, credit]);

  async function startWithdraw() {
    const amount = amountValue(withdrawAmount);
    if (amount == null) {
      setError(`Enter a withdrawal from ${MIN} to ${MAX}.`);
      return;
    }
    if (amount - available > 0.001) {
      setError("Not enough available balance.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/paypal/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, email: email.trim() }),
      });
      const payload = (await response.json()) as { ok?: boolean; amount?: number; error?: string };
      if (!payload.ok || payload.amount == null) {
        setError(payload.error ?? "PayPal sandbox did not accept the withdrawal.");
        return;
      }
      const result = withdraw(payload.amount);
      if (!result.ok) {
        setError(`${result.error} PayPal already accepted the payout.`);
        return;
      }
      setConfirmWithdraw(false);
      setMessage(`Sent ${formatMoney(payload.amount)} USD to ${email.trim()} in the PayPal sandbox.`);
    } catch {
      setError("PayPal sandbox did not respond.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell backHref="/">
      <div className="bg-[#0c7a45] px-3 py-3 font-bold text-white sm:rounded-t-lg sm:px-6">Wallet</div>
      <div className="space-y-4 px-3 py-4 text-sm sm:px-6">
        <p>1 credit is 1.00 USD. Limits are {MIN} to {formatMoney(MAX)} per payment.</p>
        <p>
          Available <span className="font-bold">{ready ? formatMoney(available) : "…"}</span>
          {" · "}
          <Link href="/bets" className="font-semibold text-[#0c7a45]">
            Open bets
          </Link>
        </p>
        {notice ? <p className="rounded bg-[#fff6d8] px-3 py-2 text-[#6a5300]">{notice}</p> : null}
        {message ? <p className="font-semibold text-[#0c7a45]">{message}</p> : null}
        {error ? <p className="font-semibold text-[#e10600]">{error}</p> : null}
        {configured ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded border border-[#e5e5e5] p-3">
              <h2 className="font-bold">Deposit</h2>
              <label className="mt-3 block text-xs font-bold text-[#666]" htmlFor="deposit-amount">
                Amount (USD)
              </label>
              <input
                id="deposit-amount"
                inputMode="decimal"
                value={depositAmount}
                onChange={(event) => setDepositAmount(event.target.value)}
                className="mt-1 h-11 w-full rounded border border-[#d7d7d7] px-3"
              />
              <div ref={buttonHost} className="relative z-10 mt-3 min-h-11" />
            </section>
            <section className="rounded border border-[#e5e5e5] p-3">
              <h2 className="font-bold">Withdraw</h2>
              <label className="mt-3 block text-xs font-bold text-[#666]" htmlFor="withdraw-amount">
                Amount (USD)
              </label>
              <input
                id="withdraw-amount"
                inputMode="decimal"
                value={withdrawAmount}
                onChange={(event) => setWithdrawAmount(event.target.value)}
                className="mt-1 h-11 w-full rounded border border-[#d7d7d7] px-3"
              />
              <label className="mt-3 block text-xs font-bold text-[#666]" htmlFor="paypal-email">
                Sandbox PayPal email
              </label>
              <input
                id="paypal-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 h-11 w-full rounded border border-[#d7d7d7] px-3"
              />
              {confirmWithdraw ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void startWithdraw()}
                    className="rounded bg-[#e10600] px-3 py-2 font-bold text-white disabled:opacity-50"
                  >
                    Confirm withdraw
                  </button>
                  <button type="button" onClick={() => setConfirmWithdraw(false)} className="underline">
                    Back
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setError(null);
                    if (amountValue(withdrawAmount) == null) {
                      setError(`Enter a withdrawal from ${MIN} to ${MAX}.`);
                      return;
                    }
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
                      setError("Enter a sandbox PayPal email.");
                      return;
                    }
                    setConfirmWithdraw(true);
                  }}
                  className="mt-3 rounded bg-[#0c7a45] px-3 py-2 font-bold text-white disabled:opacity-50"
                >
                  Withdraw to PayPal sandbox
                </button>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
