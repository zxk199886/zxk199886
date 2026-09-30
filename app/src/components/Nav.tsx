"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { env } from "@/lib/env";
import { WalletButton } from "./WalletButton";

const LINKS = [
  { href: "/", label: "Launches" },
  { href: "/create", label: "Create" },
  { href: "/vault", label: "Vault" },
  { href: "/rewards", label: "Rewards" },
];

export function Mark({ className = "" }: { className?: string }) {
  // A die face seen edge-on through a closed eye: the Unknown mark.
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M2.5 12c2.6-4.4 5.8-6.6 9.5-6.6s6.9 2.2 9.5 6.6c-2.6 4.4-5.8 6.6-9.5 6.6S5.1 16.4 2.5 12Z" stroke="currentColor" strokeWidth="1.2" />
      <rect x="9" y="9" width="6" height="6" rx="1.2" transform="rotate(45 12 12)" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function Nav() {
  const path = usePathname();
  return (
    <header
      className="sticky z-40 border-b hairline bg-bg/70 backdrop-blur-xl"
      style={{ top: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-fg">
          <Mark className="size-6 text-glow" />
          <span className="text-[0.8125rem] font-semibold tracking-[0.34em]">UNKNOWN</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${active ? "bg-raised text-fg" : "text-muted hover:text-fg"}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="label hidden rounded-full border hairline px-2.5 py-1 sm:inline">{env.cluster}</span>
          <WalletButton />
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-full px-3 py-1 text-sm text-muted">
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
