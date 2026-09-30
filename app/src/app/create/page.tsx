"use client";

import { PublicKey } from "@solana/web3.js";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useRitual } from "@/components/rituals/RitualProvider";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/api";
import { explain, useUnknown } from "@/lib/chain";
import { env } from "@/lib/env";
import { useMeta } from "@/lib/hooks";

/** Downscale an uploaded image to a 256px square so metadata stays small. */
async function toIcon(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    const s = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
    return c.toDataURL("image/webp", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const RULES = [
  ["Keys burned at birth", "Mint, freeze and metadata authorities are revoked in the same transaction that creates the token."],
  ["Your buy is rolled", "Two dice decide how much of your buy you can sell at once: their sum × 3%. The rest unlocks over three hours after opening."],
  ["You can’t take it back", "Once the dice are cast the roll lands. A refund only happens if the oracle never answers."],
  ["The open is unknown", "Trading starts at a random tick within about 30 minutes. You will learn when it opens at the same moment as everyone else."],
  ["Holding pays", "Your share of creator fees is what’s left in your vault ÷ the most it ever held. Sell half, earn half, forever. The rest goes to holders."],
] as const;

export default function CreatePage() {
  const meta = useMeta();
  const { client, send, wallet } = useUnknown();
  const ritual = useRitual();
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<string>();
  const [devBuy, setDevBuy] = useState("1");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const polling = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => () => clearInterval(polling.current), []);

  const min = meta ? Number(meta.minDevBuy) / 1e9 : 0.1;
  const max = meta ? Number(meta.maxDevBuy) / 1e9 : 10;
  const buy = Number(devBuy);
  const valid = name.trim() && symbol.trim() && buy >= min && buy <= max && accepted;
  const vrf = env.vrfMode === "mock" ? "local oracle" : "ORAO VRF";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !wallet.publicKey) return;
    setBusy(true);
    try {
      const { uri } = await api.uploadMetadata({ name: name.trim(), symbol: symbol.trim().toUpperCase(), description, image: image ?? "" });
      const { ixs, mint } = await client.createLaunch({
        creator: wallet.publicKey,
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        uri,
        devBuyLamports: BigInt(Math.round(buy * 1e9)),
      });
      await send(ixs, [mint]);
      const m = mint.publicKey;
      const sym = symbol.trim().toUpperCase();
      const go = () => {
        ritual.close();
        router.push(`/token/${m.toBase58()}`);
      };
      ritual.show({ kind: "dice", props: { symbol: sym, vrf, onContinue: go } });
      polling.current = setInterval(async () => {
        try {
          const l = await client.fetchLaunch(new PublicKey(m));
          if (l.d1 > 0) {
            clearInterval(polling.current);
            ritual.update({ kind: "dice", props: { symbol: sym, vrf, d1: l.d1, d2: l.d2, onContinue: go } });
          }
        } catch {
          /* keep waiting */
        }
      }, 1200);
    } catch (err) {
      toast({ tone: "error", text: explain(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-12 pt-12 lg:grid-cols-[minmax(0,1fr)_400px]">
      <form onSubmit={submit} className="flex flex-col gap-8">
        <div>
          <p className="label">New launch</p>
          <h1 className="mt-2 text-4xl font-medium tracking-[-0.03em]">Create a token</h1>
          <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
            You commit your buy before you see the dice. That is the whole idea.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-[1fr_160px]">
          <label className="flex flex-col gap-2" htmlFor="token-name">
            <span className="label">Name</span>
            <input id="token-name" className="field" maxLength={32} placeholder="Hollow Moon" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-2" htmlFor="token-symbol">
            <span className="label">Symbol</span>
            <input
              id="token-symbol"
              className="field num uppercase"
              maxLength={10}
              placeholder="HMOON"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
            />
          </label>
        </div>

        <label className="flex flex-col gap-2" htmlFor="token-description">
          <span className="label">Description</span>
          <textarea
            id="token-description"
            className="field min-h-24 resize-y"
            maxLength={500}
            placeholder="Tidal. Unknowable. Mostly harmless."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <div className="flex items-center gap-4">
          <div className="flex size-20 items-center justify-center overflow-hidden rounded-xl border hairline bg-surface">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="Token image preview" className="size-full object-cover" />
            ) : (
              <span className="label">image</span>
            )}
          </div>
          <label className="btn btn-ghost cursor-pointer" htmlFor="token-image">
            {image ? "Replace image" : "Upload image"}
            <input
              id="token-image"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setImage(await toIcon(f).catch(() => undefined));
              }}
            />
          </label>
        </div>

        <div className="panel flex flex-col gap-4 p-5">
          <div className="flex items-baseline justify-between">
            <label className="label" htmlFor="dev-buy">
              Your buy
            </label>
            <span className="num text-2xl">
              {devBuy || "0"} <span className="text-sm text-muted">SOL</span>
            </span>
          </div>
          <input
            id="dev-buy"
            type="range"
            min={min}
            max={max}
            step={0.1}
            value={buy || min}
            onChange={(e) => setDevBuy(e.target.value)}
            className="w-full accent-[var(--glow)]"
          />
          <div className="num flex justify-between text-[0.6875rem] text-faint">
            <span>{min} SOL min</span>
            <span>
              free after the roll: {(buy * 0.06).toFixed(2)}–{(buy * 0.36).toFixed(2)} SOL worth
            </span>
            <span>{max} SOL max</span>
          </div>
        </div>

        <label className="flex items-start gap-3 text-sm text-muted" htmlFor="accept-rules">
          <input
            id="accept-rules"
            type="checkbox"
            className="mt-1 accent-[var(--glow)]"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
          />
          I understand the dice decide how much of my buy I can sell, and that I can’t cancel once they are cast.
        </label>

        {wallet.publicKey ? (
          <button type="submit" className="btn btn-primary h-12 self-start px-8" disabled={!valid || busy}>
            {busy ? "Casting…" : "Cast the dice"}
          </button>
        ) : (
          <p className="text-sm text-muted">Connect a wallet to launch.</p>
        )}
      </form>

      <aside className="flex flex-col gap-3">
        <p className="label">The rules you are agreeing to</p>
        <ol className="panel divide-y divide-line">
          {RULES.map(([title, body], i) => (
            <li key={title} className="grid grid-cols-[1.5rem_1fr] gap-3 p-4">
              <span className="rite text-sm tracking-[0.04em] text-bone/60">{["I", "II", "III", "IV", "V"][i]}</span>
              <div>
                <p className="text-sm text-fg">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
