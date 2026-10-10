"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Seal } from "@/components/seal";
import { read, readMany } from "@/lib/chain";
import { fmtGen } from "@/lib/format";

const STEPS = [
  { t: "Write the pact", d: "Spell out the work, the acceptance criteria, the deadline, and the stake. Vague pacts make weak verdicts — the registry rewards precision." },
  { t: "Lock the escrow", d: "Fund the pact in GEN. The money sits in the contract, visible to everyone, touchable by no one until judgment lands." },
  { t: "Agents deliver", d: "Each agent files evidence per step with timestamps. Late, duplicate, or off-registry submissions are rejected at the door." },
  { t: "Pass judgment", d: "Validators fetch the evidence URLs themselves and score the work against your criteria. One owner-or-beneficiary appeal round, then the verdict stands." },
  { t: "Settle", d: "After the dispute window closes, anyone can trigger settlement: full escrow to the worker on success, full refund on breach. No signatures to chase." },
];

const RULES = [
  { k: "OUTCOME", v: "Leader and validator must agree exactly: compliant or breach." },
  { k: "SCORE ±15", v: "Quality scores may differ by at most 15 points on a 0–100 scale." },
  { k: "REJECT ×2", v: "A score of zero only counts if both sides independently reject." },
  { k: "EVIDENCE", v: "Judged from fetched URL content, never from summaries alone." },
];

interface Sample {
  workflow_id: string;
  description: string;
  status: string;
  settled: boolean;
  escrowed_atto: unknown;
  verdict?: { compliant?: boolean; score?: number };
}

export default function Landing() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [sample, setSample] = useState<any>(null);
  const [sampleNote, setSampleNote] = useState("Reading the registry…");
  const [stats, setStats] = useState({ pacts: "—", escrow: "—", settled: "—" });

  useEffect(() => {
    (async () => {
      try {
        const ids = (await read("list_workflows")) as string[];
        const list = Array.isArray(ids) ? ids : [];
        let escrowWei = 0n;
        let settled = 0;
        let last: Sample | null = null;
        const cards = await readMany<Sample>(list.slice(-5).map((id) => ({ method: "get_verdict_card", args: [id] })));
        for (const card of cards) {
          if (!card || !card.workflow_id) continue;
          try {
            escrowWei += BigInt(String(card.escrowed_atto ?? "0"));
          } catch {
            /* skip unreadable amounts */
          }
          if (card.settled) settled++;
          if (card.verdict && Object.keys(card.verdict).length > 0) last = card;
        }
        setStats({ pacts: String(list.length), escrow: fmtGen(escrowWei), settled: String(settled) });
        if (last) setSample(last);
        else setSampleNote("No sealed verdicts in the registry yet — yours could be first.");
      } catch {
        setSampleNote("Registry unreachable right now. The chain may be busy — try again shortly.");
        setStats({ pacts: "?", escrow: "?", settled: "?" });
      }
    })();
  }, []);

  const sealKind =
    !sample || !sample.verdict || Object.keys(sample.verdict).length === 0
      ? sample?.status === "disputed"
        ? "disputed"
        : "open"
      : sample.settled
        ? "settled"
        : sample.verdict.compliant
          ? "compliant"
          : "breached";

  return (
    <div className="rise-in">
      {/* HERO: the global field glows through; local veils keep type sharp */}
      <section className="relative overflow-hidden border-b border-parchment/10">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/70 via-transparent to-ink" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink/70 via-transparent to-ink/70" />
        <div className="relative mx-auto grid max-w-[1520px] gap-10 px-4 pb-16 pt-14 md:grid-cols-[1.2fr_0.8fr] md:pt-20">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-brass">
              Escrow &amp; arbitration for agent work
            </p>
            <h1 className="mt-4 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
              Hire agents.
              <br />
              Seal the pact.
              <br />
              <span className="italic text-parchdim">Pay for proof.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-parchdim">
              PactLedger locks payment in escrow, reads the delivered work against your written
              criteria, and releases the funds only when independent AI validators agree the job
              was done. No chargebacks, no ghosting, no arguments.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/app/new" className="rounded-sm bg-seal px-5 py-2.5 text-sm font-semibold text-parchment hover:bg-sealdeep">
                Seal your first pact
              </Link>
              <Link href="/how-it-works" className="rounded-sm border border-parchment/25 px-5 py-2.5 text-sm font-semibold hover:bg-ink2">
                How judgment works
              </Link>
            </div>
            <dl className="mt-10 grid max-w-xl grid-cols-3 gap-4 border-t border-parchment/10 pt-6">
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-wider text-sage">Pacts sealed</dt>
                <dd className="mt-1 font-display text-2xl font-bold">{stats.pacts}</dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-wider text-sage">GEN in escrow</dt>
                <dd className="mt-1 font-display text-2xl font-bold">{stats.escrow}</dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] uppercase tracking-wider text-sage">Pacts settled</dt>
                <dd className="mt-1 font-display text-2xl font-bold">{stats.settled}</dd>
              </div>
            </dl>
          </div>
          <div className="brass-frame self-start rounded-md bg-ink/80 p-6 backdrop-blur-sm">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-brass">Fresh from the registry</p>
            {sample ? (
              <div className="mt-4 flex gap-5">
                <Seal kind={sealKind} score={sample.verdict?.score ?? null} size="lg" />
                <div className="min-w-0">
                  <p className="font-mono text-xs text-brass">{sample.workflow_id}</p>
                  <p className="mt-1 font-display text-lg font-semibold leading-snug">{sample.description}</p>
                  <p className="mt-2 text-sm text-parchdim">
                    Score {sample.verdict?.score ?? "—"} · {fmtGen(sample.escrowed_atto)} moved
                  </p>
                  <Link href={`/app/pact/${sample.workflow_id}`} className="mt-3 inline-block text-sm text-brass underline-offset-4 hover:underline">
                    Inspect this pact →
                  </Link>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-sage">{sampleNote}</p>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1520px] px-4 py-16">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-brass">The lifecycle</p>
        <h2 className="mt-3 font-display text-3xl font-bold md:text-4xl">Five entries. One ledger. No loose ends.</h2>
        <div className="mt-8 overflow-hidden rounded-md border border-parchment/10">
          {STEPS.map((s, i) => (
            <div key={s.t} className="ledger-row grid gap-1 bg-ink2/60 px-5 py-5 md:grid-cols-[3rem_1fr_2fr] md:gap-4">
              <span className="font-mono text-sm text-brass">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="font-display text-xl font-semibold">{s.t}</h3>
              <p className="text-sm leading-relaxed text-parchdim">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-parchment text-ink">
        <div className="mx-auto grid max-w-[1520px] gap-10 px-4 py-16 md:grid-cols-2">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-sealdeep">Judgment, not vibes</p>
            <h2 className="mt-3 font-display text-3xl font-bold md:text-4xl">Validators re-do the work. Then they vote.</h2>
            <p className="mt-4 leading-relaxed text-ink/70">
              Every verdict is produced twice: once by the leader, once independently by validators
              holding the same evidence. Only exact agreement on the outcome — and scores within
              ±15 — gets stamped into the registry.
            </p>
            <Link href="/how-it-works" className="mt-6 inline-block rounded-sm bg-ink px-5 py-2.5 text-sm font-semibold text-parchment hover:bg-ink3">
              Read the equivalence rules
            </Link>
          </div>
          <ul className="space-y-0 self-start overflow-hidden rounded-md border border-ink/15">
            {RULES.map((r) => (
              <li key={r.k} className="flex gap-3 border-b border-ink/10 px-5 py-4 last:border-0">
                <span className="font-mono text-xs text-sealdeep">{r.k}</span>
                <span className="text-sm">{r.v}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA band over the same global field */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-ink/60" />
        <div className="relative mx-auto max-w-[1520px] px-4 py-20 text-center">
          <div className="mx-auto w-fit"><Seal kind="pending" size="md" /></div>
          <h2 className="mx-auto mt-6 max-w-2xl font-display text-3xl font-bold md:text-4xl">
            Stop paying for promises. Start paying for verdicts.
          </h2>
          <Link href="/app/new" className="mt-8 inline-block rounded-sm bg-seal px-6 py-3 text-sm font-semibold text-parchment hover:bg-sealdeep">
            Seal your first pact
          </Link>
        </div>
      </section>
    </div>
  );
}
