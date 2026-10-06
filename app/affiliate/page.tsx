import Link from "next/link";
import { Shell } from "@/components/Shell";

export default function AffiliatePage() {
  return (
    <Shell backHref="/">
      <div className="bg-[#0c7a45] px-3 py-3 font-bold text-white sm:rounded-t-lg sm:px-6">Affiliate</div>
      <div className="space-y-3 px-3 py-4 text-sm sm:px-6">
        <p>Share Lotus365 with friends and follow matches together.</p>
        <Link href="/" className="inline-block font-semibold text-[#0c7a45]">
          Back to matches
        </Link>
      </div>
    </Shell>
  );
}
