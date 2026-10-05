"use client";

import { OpenBets } from "@/components/OpenBets";
import { Shell } from "@/components/Shell";

export function BetsScreen() {
  return (
    <Shell backHref="/">
      <div className="bg-[#0c7a45] px-3 py-3 font-bold text-white sm:rounded-t-lg sm:px-6">Open bets</div>
      <OpenBets />
    </Shell>
  );
}
