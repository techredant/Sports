"use client";

import Link from "next/link";
import { OpenBets } from "@/components/OpenBets";
import { Shell } from "@/components/Shell";
import { useWallet } from "@/components/WalletProvider";

export function BetsScreen() {
  const { openCount } = useWallet();
  return (
    <Shell backHref="/">
      <div className="flex items-center gap-2 bg-[#1c1c1c] px-3 py-2 text-white sm:px-6">
        <Link href="/?when=inplay" className="rounded bg-[#0c7a45] px-3 py-1 text-sm font-semibold">
          In-Play
        </Link>
        <Link href="/?focus=search" aria-label="More filters" className="rounded bg-[#333] px-2 py-1 text-sm">
          ▽
        </Link>
      </div>
      <div
        className="mt-3 ml-3 flex h-10 w-[min(18rem,72%)] items-center gap-2 bg-[#128a5a] px-4 font-semibold text-white sm:ml-6"
        style={{ clipPath: "polygon(0 0, 92% 0, 100% 100%, 0 100%)" }}
      >
        <span aria-hidden className="grid grid-cols-2 gap-0.5">
          <span className="h-1.5 w-1.5 bg-white" />
          <span className="h-1.5 w-1.5 bg-white" />
          <span className="h-1.5 w-1.5 bg-white" />
          <span className="h-1.5 w-1.5 bg-white" />
        </span>
        Main Market
      </div>
      <div className="mt-3 grid grid-cols-2 text-sm font-bold text-white">
        <Link href="/" className="flex h-11 items-center justify-center bg-[#0a6840]">
          MARKET
        </Link>
        <span className="flex h-11 items-center justify-center bg-[#0c7a45] shadow-[inset_0_-3px_0_#f5d90a]">
          OPEN BETS ({openCount})
        </span>
      </div>
      <OpenBets />
    </Shell>
  );
}
