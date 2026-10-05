"use client";

import Link from "next/link";
import { formatMoney } from "@/lib/format";
import { useWallet } from "@/components/WalletProvider";

export function Shell({
  backHref,
  children,
}: {
  backHref?: string;
  children: React.ReactNode;
}) {
  const { available, ready } = useWallet();

  return (
    <div className="min-h-screen bg-[#ececec] text-[#1b1b1b]">
      <header className="bg-[#0c7a45] text-white">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-2 px-3 sm:px-6">
          {backHref ? (
            <Link href={backHref} aria-label="Back" className="text-2xl leading-none">
              ←
            </Link>
          ) : null}
          <Link href="/" className="text-lg font-black tracking-tight sm:text-xl">
            LINE<span className="text-yellow-300">HOUSE</span>
          </Link>
          <span className="rounded bg-yellow-300 px-1.5 py-0.5 text-[10px] font-black tracking-wide text-black">
            DEMO
          </span>
          <Link
            href="/bets"
            className="ml-auto shrink-0 rounded bg-white px-2 py-1 text-right text-xs font-bold text-black"
          >
            <span className="block text-[10px] font-semibold text-[#0c7a45]">Balance</span>
            {ready ? formatMoney(available) : "…"}
          </Link>
        </div>
      </header>
      <div className="mx-auto min-h-[calc(100vh-3.5rem)] w-full max-w-7xl bg-white sm:my-4 sm:min-h-[calc(100vh-5.5rem)] sm:rounded-lg sm:shadow-sm">
        {children}
      </div>
    </div>
  );
}
