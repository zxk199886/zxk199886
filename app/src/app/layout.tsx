import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/500.css";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Unknown",
  description: "A Solana launchpad where the dice decide what the dev can dump and nobody knows when the market opens.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <Providers>
          <div className="relative isolate">
            <div className="halo" />
            <Nav />
            <main className="relative mx-auto max-w-7xl px-4 pb-24 sm:px-6">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
