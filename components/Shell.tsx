"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  const pathname = usePathname();
  const router = useRouter();

  function openSearch() {
    if (pathname === "/") {
      document.getElementById("match-search")?.focus();
      return;
    }
    router.push("/?focus=search");
  }

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
            LOTUS<span className="text-yellow-300">365</span>
          </Link>
          <button type="button" aria-label="Search" onClick={openSearch} className="ml-auto text-xl leading-none">
            ⌕
          </button>
          <Link href="/affiliate" className="rounded bg-yellow-300 px-2 py-1 text-xs font-black text-black sm:px-3 sm:text-sm">
            Affiliate
          </Link>
          <Link
            href="/wallet"
            aria-label={ready ? `Wallet ${formatMoney(available)}` : "Wallet"}
            className="flex shrink-0 items-center gap-1 rounded bg-white px-2 py-1 text-xs font-bold text-black"
          >
            <span aria-hidden className="text-base leading-none text-[#0c7a45]">
              ☻
            </span>
            {ready ? formatMoney(available) : "…"}
          </Link>
        </div>
      </header>
      <div className="relative mx-auto min-h-[calc(100vh-3.5rem)] w-full max-w-7xl bg-white max-sm:pr-10 sm:my-4 sm:min-h-[calc(100vh-5.5rem)] sm:rounded-lg sm:shadow-sm">
        {children}
      </div>
      <div className="pointer-events-none fixed top-1/3 right-0 z-40">
        <div className="rounded-l bg-[#0c7a45] px-1.5 py-3 text-[11px] font-bold tracking-wide text-white [writing-mode:vertical-rl]">
          This is Demo ID
        </div>
      </div>
    </div>
  );
}
