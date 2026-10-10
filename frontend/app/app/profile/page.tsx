"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Seal, type SealKind } from "@/components/seal";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/components/wallet-modal";
import { read, readMany } from "@/lib/chain";
import { fmtGen, toNum } from "@/lib/format";
import { getAddress, onWalletChange } from "@/lib/wallet";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Card = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sealKind(r: any): SealKind {
  if (r.settled) return "settled";
  if (r.status === "disputed") return "disputed";
  if (r.verdict && Object.keys(r.verdict).length > 0) return r.verdict.compliant ? "compliant" : "breached";
  return "open";
}

export default function Profile() {
  const wallet = useWallet();
  const [me, setMe] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [owned, setOwned] = useState<Card[]>([]);
  const [benefiting, setBenefiting] = useState<Card[]>([]);
  const [lookup, setLookup] = useState("");
  const [lookupScore, setLookupScore] = useState<string | null>(null);

  useEffect(() => {
    setMe((getAddress() || "").toLowerCase());
    const off = onWalletChange(() => setMe((getAddress() || "").toLowerCase()));
    return off;
  }, []);

  useEffect(() => {
    if (!me) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      setError("");
      try {
        const ids = (await read("list_workflows")) as string[];
        const list = Array.isArray(ids) ? ids : [];
        const cards = await readMany<Card>(list.map((id) => ({ method: "get_verdict_card", args: [id] })));
        const own: Card[] = [];
        const ben: Card[] = [];
        for (const card of cards) {
          if (!card || !card.workflow_id) continue;
          if (String(card.owner || "").toLowerCase() === me) own.push(card);
          else if (String(card.beneficiary || "").toLowerCase() === me) ben.push(card);
        }
        setOwned(own.reverse());
        setBenefiting(ben.reverse());
      } catch {
        setError("Registry unreachable. The chain may be busy — retry in a moment.");
      } finally {
        setLoading(false);
      }
    })();
  }, [me]);

  async function checkReputation() {
    if (!lookup.trim()) return;
    try {
      const s = await read("get_reputation", [lookup.trim()]);
      setLookupScore(String(s));
    } catch {
      setLookupScore("unreachable");
    }
  }

  const escrowLocked = [...owned, ...benefiting].reduce((a, c) => {
    try {
      return a + BigInt(c.escrowed_atto || "0");
    } catch {
      return a;
    }
  }, BigInt(0));
  const settledCount = [...owned, ...benefiting].filter((c) => c.settled).length;
  const disputedCount = [...owned, ...benefiting].filter((c) => c.status === "disputed").length;

  function pactRow(c: Card) {
    return (
      <Link
        key={c.workflow_id}
        href={`/app/pact/${c.workflow_id}`}
        className="ledger-row grid items-center gap-3 bg-ink2/60 px-4 py-4 transition hover:bg-ink2 md:grid-cols-[auto_1fr_auto_auto_auto]"
      >
        <Seal kind={sealKind(c)} score={c.verdict?.score ?? null} size="sm" />
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold">{c.description}</p>
          <p className="mt-0.5 font-mono text-[11px] text-sage">{c.workflow_id} · {String(c.evidence_count)} filings</p>
        </div>
        <span className="font-mono text-xs text-brass">{fmtGen(c.escrowed_atto)} escrow</span>
        <span className={`font-mono text-xs ${c.settled ? "text-pine" : "text-parchdim"}`}>{c.settled ? "settled" : c.status}</span>
        <span className="font-mono text-xs text-brass underline underline-offset-4">Detail →</span>
      </Link>
    );
  }

  return (
    <div className="rise-in mx-auto max-w-[1520px] px-4 py-10">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-brass">Profile</p>
      <h1 className="mt-2 font-display text-4xl font-bold">Your ledger page</h1>

      {!me ? (
        <div className="mt-8 max-w-xl rounded-md border border-brass/40 bg-ink2 p-6">
          <p className="font-display text-xl font-semibold">No wallet connected.</p>
          <p className="mt-1 text-sm text-parchdim">Connect to see your pacts, escrow, verdicts, and standing.</p>
          <Button variant="brass" size="md" className="mt-4" onClick={() => wallet.open()}>Connect wallet</Button>
        </div>
      ) : loading ? (
        <div className="mt-8 space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-md bg-ink2"></div>
          ))}
        </div>
      ) : error ? (
        <p className="mt-8 rounded-sm border border-seal/50 bg-sealdeep/20 px-4 py-3 text-sm text-seal" role="alert">{error}</p>
      ) : (
        <>
          <p className="mt-2 break-all font-mono text-xs text-sage">{me}</p>
          <dl className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ["Pacts owned", String(owned.length)],
              ["Payable to you", String(benefiting.length)],
              ["GEN still escrowed", fmtGen(escrowLocked)],
              ["Settled / disputed", `${settledCount} / ${disputedCount}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-md border border-parchment/10 bg-ink2 px-4 py-4">
                <dt className="font-mono text-[11px] uppercase tracking-wider text-sage">{k}</dt>
                <dd className="mt-1 font-display text-2xl font-bold">{v}</dd>
              </div>
            ))}
          </dl>

          <h2 className="mt-10 font-display text-2xl font-semibold">Pacts you own</h2>
          {owned.length === 0 ? (
            <p className="mt-3 text-sm text-parchdim">None yet. <Link href="/app/new" className="text-brass underline underline-offset-2">Seal your first pact</Link>.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-md border border-parchment/10">{owned.map(pactRow)}</div>
          )}

          <h2 className="mt-10 font-display text-2xl font-semibold">Payable to you</h2>
          {benefiting.length === 0 ? (
            <p className="mt-3 text-sm text-parchdim">No one named you beneficiary yet.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-md border border-parchment/10">{benefiting.map(pactRow)}</div>
          )}

          <h2 className="mt-10 font-display text-2xl font-semibold">Agent standing lookup</h2>
          <div className="mt-3 flex max-w-md gap-2">
            <input
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              placeholder="agent name, e.g. agent-alpha"
              className="w-full rounded-sm border border-parchment/20 bg-ink px-3 py-2 font-mono text-sm"
            />
            <Button variant="ghost" size="sm" onClick={checkReputation}>Check</Button>
          </div>
          {lookupScore !== null && (
            <p className="mt-2 font-mono text-sm">
              {lookup.trim()} · <b className={toNum(lookupScore) >= 100 ? "text-pine" : "text-seal"}>{lookupScore}</b>
            </p>
          )}

          <div className="mt-10">
            <Button variant="danger" size="sm" onClick={() => { wallet.lock(); setMe(""); }}>Lock wallet</Button>
          </div>
        </>
      )}
    </div>
  );
}
