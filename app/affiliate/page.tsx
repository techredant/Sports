import Link from "next/link";
import { Shell } from "@/components/Shell";

export default function AffiliatePage() {
  return (
    <Shell backHref="/">
      <div className="bg-[#0c7a45] px-3 py-3 font-bold text-white sm:rounded-t-lg sm:px-6">Affiliate</div>
      <div className="space-y-3 px-3 py-4 text-sm sm:px-6">
        <p>This affiliate button is part of the demo. It does not sign anyone up or pay a commission.</p>
        <p>Share the demo link with friends if you want them to try the simulated exchange.</p>
        <Link href="/" className="inline-block font-semibold text-[#0c7a45]">
          Back to matches
        </Link>
      </div>
    </Shell>
  );
}
