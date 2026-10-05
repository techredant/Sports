import { Suspense } from "react";
import { HomeScreen } from "@/components/HomeScreen";

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-center text-sm">Loading markets…</p>}>
      <HomeScreen />
    </Suspense>
  );
}
