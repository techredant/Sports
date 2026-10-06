import { Suspense } from "react";
import { WalletScreen } from "@/components/WalletScreen";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-center text-sm">Loading wallet…</p>}>
      <WalletScreen />
    </Suspense>
  );
}
