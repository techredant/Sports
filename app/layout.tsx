import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { WalletProvider } from "@/components/WalletProvider";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Linehouse",
  description: "Demo sports exchange with live odds and simulated bets.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full">
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
