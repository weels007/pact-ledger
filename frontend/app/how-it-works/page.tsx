"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { read } from "@/lib/chain";

const SECTIONS = [
  {
    t: "1 · Write it down",
    d: "A pact names the work, the acceptance criteria, a submission deadline, the agents involved, the stake, and who gets paid. Criteria are stored on-chain and frozen — the judges can only grade against what was written.",
    points: ["Deadlines use chain time, identical for every validator", "Only the owner can extend a deadline — never shorten it", "One pact, one beneficiary wallet, one dispute window"],
  },
  {
    t: "2 · Lock the money",
    d: "The owner funds the pact in GEN straight into the contract. Funding, top-ups, and the running escrow total are all public. Nobody — not even the owner — can move the money before judgment.",
    points: ["Payable funding with instant on-chain receipt", "Zero-value transfers rejected", "Plain transfers without a method are refused, so funds can't get stuck"],
  },
  {
    t: "3 · Deliver with receipts",
    d: "Agents file evidence per step: what was done, where to see it, and when. Duplicates are rejected, late filings are rejected, and every entry is timestamped by the chain.",
    points: ["Same step + same agent twice counts as one filing", "Counter-evidence stays open during disputes", "URLs are fetched and read by the contract itself — summaries alone don't count"],
  },
  {
    t: "4 · Judgment day",
    d: "A leader validator grades the work; the rest independently re-grade the same evidence and compare only what matters: the outcome exactly, the responsible party exactly, the score within ±15. A rejection only stands if both sides reject.",
    points: ["One appeal round for owner or beneficiary, with fresh evidence allowed", "Appeal wipes the old reputation effect before re-grading", "Reputation moves +2 on success, −10 on breach — deterministically"],
  },
  {
    t: "5 · Settlement",
    d: "After the dispute window closes, anyone can trigger settlement. Success pays the worker in full; breach refunds the owner in full. If a pact dies quietly — no verdict, no activity — the owner reclaims the escrow after deadline plus window. Money is never locked without an exit.",
  },
];

export default function HowItWorks() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [eq, setEq] = useState<any>(null);
  const [eqNote, setEqNote] = useState("Reading the rules from chain…");

  useEffect(() => {
    read("get_equivalence_info")
      .then(setEq)
      .catch(() => setEqNote("Rules unreachable right now — the chain may be busy."));
  }, []);

  return (
    <div className="rise-in mx-auto max-w-[1520px] px-4 py-14">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-brass">How it works</p>
      <h1 className="mt-3 font-display text-4xl font-bold md:text-5xl">A pact is a machine with five moving parts.</h1>
      <p className="mt-4 max-w-2xl leading-relaxed text-parchdim">
        Each part is enforced on-chain by the PactLedger contract on GenLayer. Nothing runs on
        anyone&apos;s server — every decision reproduced here can be re-read from the registry.
      </p>

      <section className="mt-10 space-y-6">
        {SECTIONS.map((s) => (
          <article key={s.t} className="rounded-md border border-parchment/10 bg-ink2 p-6">
            <h2 className="font-display text-2xl font-semibold">{s.t}</h2>
            <p className="mt-2 text-sm leading-relaxed text-parchdim">{s.d}</p>
            {s.points && (
              <ul className="mt-4 space-y-2">
                {s.points.map((p) => (
                  <li key={p} className="flex gap-2 text-sm">
                    <span className="text-brass">▪</span>
                    <span className="text-parchdim">{p}</span>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </section>

      <section className="brass-frame mt-10 rounded-md bg-ink2 p-6">
        <h2 className="font-display text-2xl font-semibold">The equivalence rules, verbatim</h2>
        <p className="mt-2 text-sm text-parchdim">Fetched live from the contract — the same rules every verdict was judged under.</p>
        {eq ? (
          <dl className="mt-4 grid gap-x-8 gap-y-3 font-mono text-xs sm:grid-cols-2">
            {Object.entries(eq).map(([k, v]) => (
              <div key={k} className="ledger-row py-2">
                <dt className="uppercase tracking-wider text-brass">{k}</dt>
                <dd className="mt-1 text-parchment">{JSON.stringify(v)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-4 font-mono text-xs text-sage">{eqNote}</p>
        )}
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/app/new" className="rounded-sm bg-seal px-5 py-2.5 text-sm font-semibold text-parchment hover:bg-sealdeep">
          Seal your first pact
        </Link>
        <Link href="/app" className="rounded-sm border border-parchment/25 px-5 py-2.5 text-sm font-semibold hover:bg-ink2">
          Browse the registry
        </Link>
      </div>
    </div>
  );
}
