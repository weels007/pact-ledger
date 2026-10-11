"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Seal, type SealKind } from "@/components/seal";
import { Button } from "@/components/ui/button";
import { useTx } from "@/components/tx-track";
import { useWallet } from "@/components/wallet-modal";
import { executionOutcome, friendlyError, read, write } from "@/lib/chain";
import { fmtCountdown, fmtGen, fmtUnix, genToAtto, toNum, datetimeLocalToUnix } from "@/lib/format";
import { getAddress, onWalletChange } from "@/lib/wallet";
import { EXPLORER_BASE } from "@/lib/config";

const METHOD_LABEL: Record<string, string> = {
  register_workflow: "Pact sealed",
  submit_evidence: "Evidence filed",
  adjudicate_workflow: "Judgment passed",
  open_dispute: "Dispute opened",
  resolve_dispute: "Dispute re-judged",
  settle_workflow: "Escrow settled",
  fund_workflow: "Escrow funded",
  extend_deadline: "Deadline extended",
  recover_escrow: "Escrow recovered",
};

interface TrailTx {
  hash: string;
  kind: string;
  method: string | null;
  status: string;
  exec: string | null;
  consensus: "accepted" | "undetermined" | null;
  agree: number;
  disagree: number;
  idle: number;
  rotations: number;
  appealed: boolean;
  time: string;
  value: string;
  rounds: { exec: string | null; vote: string | null }[];
  proposal: { compliant: boolean | null; score: number | null; responsible: string | null; reason: string | null } | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Card = Record<string, any>;

function TrailRow({ t, ai }: { t: TrailTx; ai: boolean }) {
  const [open, setOpen] = useState(false);
  const consensusCls =
    t.consensus === "accepted" ? "text-pine" : t.consensus === "undetermined" ? "text-seal" : "text-sage";
  return (
    <div className={`ledger-row px-4 py-3 ${ai ? "border-l-2 border-l-brass" : ""}`}>
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="block w-full text-left">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-sm font-semibold">
            {t.method ? (METHOD_LABEL[t.method] || t.method) : t.kind === "send" ? "GEN transfer" : t.kind}
          </span>
          {ai && <span className="rounded-sm bg-brass/20 px-1.5 py-0.5 font-mono text-[10px] text-brass">AI consensus</span>}
          {t.consensus && <span className={`font-mono text-[11px] font-semibold uppercase ${consensusCls}`}>{t.consensus}</span>}
          <span className="ml-auto font-mono text-[11px] text-sage">{open ? "▾ detail" : "▸ detail"}</span>
        </div>
        <p className="mt-1 font-mono text-[11px] text-parchdim">
          leader exec: {t.exec || "?"} · {t.agree + t.disagree + t.idle > 0
            ? `${t.agree} agree · ${t.disagree} disagree · ${t.idle} idle`
            : "no validator votes recorded"}
          {t.rotations > 0 ? ` · ${t.rotations} rotation${t.rotations > 1 ? "s" : ""}` : ""}
          {t.appealed ? " · appealed" : ""}
          {t.time ? ` · ${t.time.slice(0, 16).replace("T", " ")} UTC` : ""}
        </p>
      </button>
      {open && (
        <div className="mt-2 rounded-sm border border-parchment/10 bg-ink px-3 py-2">
          {t.proposal && (t.proposal.compliant !== null || t.proposal.score !== null || t.proposal.reason) ? (
            <div className="text-xs">
              <p className="font-mono text-[11px] uppercase tracking-wider text-brass">Leader proposal</p>
              <p className="mt-1">
                <b className={t.proposal.compliant ? "text-pine" : "text-seal"}>
                  {t.proposal.compliant === null ? "?" : t.proposal.compliant ? "compliant" : "breach"}
                </b>
                {t.proposal.score !== null && <span className="font-mono"> · score {t.proposal.score}</span>}
                {t.proposal.responsible && <span> · responsible: <span className="font-mono">{t.proposal.responsible}</span></span>}
              </p>
              {t.proposal.reason && <p className="mt-1 leading-relaxed text-parchdim">{t.proposal.reason}</p>}
              {t.consensus === "undetermined" && (
                <p className="mt-2 text-parchdim">No majority agreed — nothing was stored by this transaction. The pact keeps its previous state.</p>
              )}
            </div>
          ) : (
            <p className="font-mono text-[11px] text-sage">No AI proposal on this transaction.</p>
          )}
          {t.rounds.length > 1 && (
            <div className="mt-2 border-t border-parchment/10 pt-2">
              <p className="font-mono text-[11px] uppercase tracking-wider text-brass">Rounds</p>
              {t.rounds.map((r, i) => (
                <p key={i} className="mt-0.5 font-mono text-[11px] text-parchdim">
                  round {i}: exec {r.exec || "?"} · vote {r.vote || "—"}
                </p>
              ))}
            </div>
          )}
          <a href={`${EXPLORER_BASE}/tx/${t.hash}`} target="_blank" rel="noreferrer" className="mt-2 inline-block font-mono text-[11px] text-sage underline-offset-2 hover:text-parchment hover:underline">
            {t.hash.slice(0, 14)}… full receipt in explorer ↗
          </a>
        </div>
      )}
    </div>
  );
}

function ActionCard({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {  return (
    <section className="rounded-md border border-parchment/10 bg-ink2 p-5">
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-xs text-parchdim">{hint}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default function PactDetail({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string>("");
  const tx = useTx();
  const wallet = useWallet();
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionOk, setActionOk] = useState("");
  const [fundAmt, setFundAmt] = useState("0.5");
  const [ev, setEv] = useState({ step: "", agent: "", url: "", summary: "" });
  const [note, setNote] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [page, setPage] = useState({ total: 0, offset: 0, limit: 5 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [items, setItems] = useState<any[]>([]);
  const [me, setMe] = useState("");
  const [trail, setTrail] = useState<TrailTx[]>([]);
  const [trailNote, setTrailNote] = useState("Reading the consensus trail…");
  const actingRef = useRef(false);
  const cardRef = useRef<Card | null>(null);
  // Prerender-safe: real clock only starts client-side (Next forbids
  // Date.now() during prerender).
  const [nowTick, setNowTick] = useState(0);

  const input = "w-full rounded-sm border border-parchment/20 bg-ink px-3 py-2 text-sm";

  useEffect(() => {
    params.then((p) => setId(decodeURIComponent(p.id)));
    setMe((getAddress() || "").toLowerCase());
  }, [params]);

  // Live countdown + pick up wallet changes made elsewhere (modal).
  useEffect(() => {
    setNowTick(Math.floor(Date.now() / 1000));
    const t = setInterval(() => setNowTick(Math.floor(Date.now() / 1000)), 1000);
    const off = onWalletChange(() => setMe((getAddress() || "").toLowerCase()));
    return () => {
      clearInterval(t);
      off();
    };
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const c = (await read("get_verdict_card", [id])) as Card;
      if (!c || !c.workflow_id) throw new Error("empty");
      setCard(c);
      cardRef.current = c;
      await loadPage(0);
    } catch {
      setError("Pact not found or chain unreachable.");
    } finally {
      setLoading(false);
    }
    try {
      const r = await fetch(`/api/history?workflow=${encodeURIComponent(id)}`);
      const body = await r.json();
      const txs = Array.isArray(body.txs) ? body.txs : [];
      setTrail(txs);
      if (txs.length === 0) setTrailNote("No trail entries indexed yet for this pact.");
    } catch {
      setTrailNote("Consensus trail unreachable right now.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadPage(offset: number) {
    try {
      // u256 args as bigint (raw numbers/strings crash VM int decoding).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = (await read("get_evidence_page", [id, BigInt(offset), BigInt(5)])) as any;
      setPage({ total: toNum(p.total), offset: toNum(p.offset), limit: toNum(p.limit) });
      setItems(JSON.parse(p.items_json || "[]"));
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  const hasVerdict = !!card?.verdict && Object.keys(card.verdict).length > 0;
  const sealKind: SealKind = !card
    ? "pending"
    : card.settled
      ? "settled"
      : card.status === "disputed"
        ? "disputed"
        : hasVerdict
          ? card.verdict.compliant
            ? "compliant"
            : "breached"
          : "open";

  const isAuthed = !!me;
  const isOwner = !!card && !!me && String(card.owner || "").toLowerCase() === me;
  const isBeneficiary = !!card && !!me && String(card.beneficiary || "").toLowerCase() === me;

  const canFund = isOwner && card?.status === "open" && !card?.settled;
  const canFile = isAuthed && ["open", "disputed"].includes(card?.status) && !card?.settled;
  const canJudge = isOwner && card?.status === "open" && toNum(card?.evidence_count) > 0;
  const canDispute =
    (isOwner || isBeneficiary) &&
    ["compliant", "breached"].includes(card?.status) &&
    !card?.settled &&
    toNum(card?.appeal_count) < 1 &&
    !!card?.settle_after && nowTick < toNum(card.settle_after);
  const canResolve = (isOwner || isBeneficiary) && card?.status === "disputed";
  const canSettle = isAuthed && ["compliant", "breached"].includes(card?.status) && !card?.settled;
  const settleReady = !!card?.settle_after && nowTick >= toNum(card.settle_after);
  const canRecover = isOwner && !card?.settled && card?.status === "open";
  const canExtend = isOwner && card?.status === "open" && !card?.settled;

  async function act(
    title: string,
    method: string,
    args: unknown[],
    opts: { valueAtto?: bigint },
    doneMsg: string,
    // State confirmation beats receipt parsing: receipts are heuristic,
    // chain state is truth. Captures pre-state via closure when needed.
    confirm?: (fresh: Card | null) => boolean
  ) {
    // Ref guard: React state updates async, so rapid double-clicks could
    // otherwise fire two transactions before `busy` disables the button.
    if (actingRef.current) return;
    actingRef.current = true;
    setBusy(true);
    setActionError("");
    setActionOk("");
    const tracker = tx.push({ title, hash: "…" });
    try {
      const { hash, receipt } = await write(method, args, {
        ...opts,
        onHash: (h) => tx.update(tracker, { hash: h }),
      });
      const out = executionOutcome(receipt);
      if (out.expectedMessage) {
        // Deterministic revert — fast fail, no extra reads needed.
        const msg = `Rejected: ${out.expectedMessage}`;
        tx.update(tracker, { tone: "bad", hash, note: msg });
        setActionError(msg);
        return;
      }
      await load();
      const confirmed = confirm ? confirm(cardRef.current) : out.ok;
      if (!confirmed && !out.ok) {
        const msg = "Finalized without visible effect — validators may not have agreed. Nothing changed; check the trail below.";
        tx.update(tracker, { tone: "bad", hash, note: msg });
        setActionError(msg);
        return;
      }
      tx.update(tracker, { tone: "good", hash, note: doneMsg });
      setActionOk(confirmed ? doneMsg : `${doneMsg} (receipt was ambiguous — verify above.)`);
      await load();
    } catch (e) {
      const msg = friendlyError(e);
      tx.update(tracker, { tone: "bad", note: msg });
      setActionError(msg);
    } finally {
      actingRef.current = false;
      setBusy(false);
    }
  }

  const doExtend = () => {
    const target = datetimeLocalToUnix(newDeadline);
    return act(`Extending ${id}`, "extend_deadline", [id, BigInt(target)], {}, "Deadline extended.",
      (c) => toNum(c?.deadline_unix) === target);
  };

  return (
    <div className="rise-in mx-auto max-w-[1520px] px-4 py-10">
      <Link href="/app" className="font-mono text-xs text-brass hover:underline">← Registry</Link>

      {loading ? (
        <div className="mt-6 h-64 animate-pulse rounded-md bg-ink2"></div>
      ) : error || !card ? (
        <p className="mt-6 rounded-sm border border-seal/50 bg-sealdeep/20 px-4 py-3 text-sm text-seal" role="alert">
          {error} <button className="ml-2 underline underline-offset-2" onClick={load}>Retry</button>
        </p>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-start gap-5 rounded-md border border-parchment/10 bg-ink2 p-6">
              <Seal kind={sealKind} score={card.verdict?.score ?? null} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs text-brass">{card.workflow_id}</p>
                <h1 className="mt-1 font-display text-3xl font-bold leading-tight">{card.description}</h1>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-parchdim">
                  <span>Status: <b className={card.status === "breached" ? "text-seal" : card.status === "compliant" ? "text-pine" : "text-brass"}>{card.status}</b></span>
                  <span>Escrow: <b className="text-brass">{fmtGen(card.escrowed_atto)}</b></span>
                  <span>Filings: {String(card.evidence_count)}</span>
                  <span>Deadline: {fmtUnix(card.deadline_unix)}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-md border border-parchment/10 bg-ink2 p-6">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-brass">Acceptance criteria</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{card.sla_criteria}</p>
              <div className="mt-4 grid gap-3 font-mono text-xs text-parchdim sm:grid-cols-2">
                <p>Owner <span className="block truncate text-parchment">{card.owner}</span></p>
                <p>Beneficiary <span className="block truncate text-parchment">{card.beneficiary}</span></p>
                <p>Stake <span className="block text-parchment">{fmtGen(card.penalty_atto)}</span></p>
                <p>Settle opens <span className="block text-parchment">{card.settle_after ? `${fmtUnix(card.settle_after)} (${fmtCountdown(card.settle_after)})` : "after judgment"}</span></p>
              </div>
            </div>

            {hasVerdict && (
              <div className="mt-6 rounded-md border border-parchment/10 bg-ink2 p-6">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-brass">Sealed verdict</h2>
                <div className="mt-3 grid gap-4 sm:grid-cols-[auto_1fr]">
                  <div className={`font-display text-6xl font-bold ${card.verdict.compliant ? "text-pine" : "text-seal"}`}>{String(card.verdict.score)}</div>
                  <div>
                    <p className="font-display text-xl font-semibold">
                      {card.verdict.compliant ? "Compliant — work accepted" : `Breach — ${card.verdict.responsible_party} at fault`}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-parchdim">{card.verdict.reason}</p>
                    <p className="mt-2 font-mono text-xs text-sage">Penalty recorded: {fmtGen(card.verdict.penalty_applied_atto)} · graded twice under ±15 consensus</p>
                  </div>
                </div>
                {card.dispute_note && <div className="mt-4 border-l-2 border-brass pl-3 text-sm italic text-parchdim">Dispute note: “{card.dispute_note}”</div>}
              </div>
            )}

            <div className="mt-6 rounded-md border border-parchment/10 bg-ink2 p-6">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-brass">Consensus trail</h2>
              <p className="mt-1 text-xs text-parchdim">Every transaction for this pact, with validator votes as recorded in the explorer.</p>
              {trail.length === 0 ? (
                <p className="mt-3 font-mono text-xs text-sage">{trailNote}</p>
              ) : (
                <div className="mt-3 overflow-hidden rounded-sm border border-parchment/10">
                  {trail.map((t) => {
                    const ai = t.method === "adjudicate_workflow" || t.method === "resolve_dispute";
                    return (
                      <TrailRow key={t.hash} t={t} ai={ai} />
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 rounded-md border border-parchment/10 bg-ink2 p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-brass">Evidence filings ({page.total})</h2>
                <div className="flex gap-2 text-xs">
                  <button disabled={page.offset === 0} onClick={() => loadPage(Math.max(0, page.offset - page.limit))} className="rounded border border-parchment/20 px-2 py-1 disabled:opacity-40">← Prev</button>
                  <button disabled={page.offset + page.limit >= page.total} onClick={() => loadPage(page.offset + page.limit)} className="rounded border border-parchment/20 px-2 py-1 disabled:opacity-40">Next →</button>
                </div>
              </div>
              <div className="mt-3 overflow-hidden rounded-sm border border-parchment/10">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {items.map((e: any) => (
                  <div key={`${e.step_id}${e.agent}${e.submitted_at}`} className="ledger-row px-4 py-3">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <span className="font-mono text-xs text-brass">{e.step_id}</span>
                      <span className="text-sm font-semibold">{e.agent}</span>
                      {e.dispute_phase && <span className="rounded-sm bg-brass/20 px-1.5 py-0.5 font-mono text-[10px] text-brass">dispute filing</span>}
                      <span className="ml-auto font-mono text-[11px] text-sage">{fmtUnix(e.submitted_at)}</span>
                    </div>
                    <p className="mt-1 text-sm text-parchdim">{e.summary}</p>
                    {e.evidence_url && <a href={e.evidence_url} target="_blank" rel="noreferrer" className="mt-1 inline-block font-mono text-[11px] text-sage underline-offset-2 hover:text-parchment hover:underline">{e.evidence_url} ↗</a>}
                  </div>
                ))}
                {items.length === 0 && <p className="px-4 py-6 text-center text-sm text-sage">No filings yet — the first one sets the tone.</p>}
              </div>
            </div>

            <div className="mt-6 rounded-md border border-parchment/10 bg-ink2 p-6">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-brass">Agent standing</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(card.reputations || {}).map(([name, score]) => (
                  <span key={name} className="rounded-sm border border-parchment/15 px-3 py-1.5 font-mono text-xs">
                    {name} · <b className={Number(score) >= 100 ? "text-pine" : "text-seal"}>{String(score)}</b>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            {!isAuthed && (
              <div className="rounded-md border border-brass/40 bg-ink2 p-5 text-sm">
                <p className="font-display text-lg font-semibold">Reading is free. Acting needs keys.</p>
                <p className="mt-1 text-parchdim">Connect a wallet to fund, file, judge, or settle.</p>
                <button onClick={() => wallet.open()} className="mt-4 block w-full rounded-sm bg-brass px-4 py-2 text-center text-sm font-semibold text-ink">Connect wallet</button>
              </div>
            )}

            {canFund && (
              <ActionCard title="Fund escrow" hint="Top up any time before judgment. GEN moves straight into the contract.">
                <div className="flex gap-2">
                  <input value={fundAmt} onChange={(e) => setFundAmt(e.target.value)} inputMode="decimal" pattern="[0-9]+(\.[0-9]+)?" placeholder="0.5" className="w-full rounded-sm border border-parchment/20 bg-ink px-3 py-2 font-mono text-sm" />
                  <Button variant="brass" size="sm" disabled={busy} onClick={() => {
                    const before = toNum(cardRef.current?.escrowed_atto);
                    return act(`Funding ${id}`, "fund_workflow", [id], { valueAtto: genToAtto(fundAmt || "0") }, `${fundAmt} GEN locked in escrow.`,
                      (c) => toNum(c?.escrowed_atto) > before);
                  }}>Fund</Button>
                </div>
              </ActionCard>
            )}

            {canFile && (
              <ActionCard title="File evidence" hint="One filing per step per agent. On-chain timestamp included automatically.">
                <input value={ev.step} onChange={(e) => setEv({ ...ev, step: e.target.value })} placeholder="step id, e.g. step-login" className={`${input} mb-2 font-mono`} />
                <input value={ev.agent} onChange={(e) => setEv({ ...ev, agent: e.target.value })} placeholder="agent name" className={`${input} mb-2 font-mono`} />
                <input value={ev.url} onChange={(e) => setEv({ ...ev, url: e.target.value })} placeholder="https://… evidence URL" className={`${input} mb-2 font-mono`} />
                <textarea value={ev.summary} onChange={(e) => setEv({ ...ev, summary: e.target.value })} rows={2} placeholder="What was delivered?" className={`${input} mb-2`} />
                <Button variant="ghost" size="block" disabled={busy} onClick={() => {
                  const before = toNum(cardRef.current?.evidence_count);
                  const step = ev.step.trim();
                  const agent = ev.agent.trim();
                  return act(`Filing on ${id}`, "submit_evidence", [id, step, agent, ev.url.trim(), ev.summary.trim()], {}, "Evidence filed with chain timestamp.",
                    (c) => toNum(c?.evidence_count) > before);
                }}>File evidence</Button>
              </ActionCard>
            )}

            {canJudge && (
              <ActionCard title="Pass judgment" hint="Runs the full validator consensus. Takes a minute or two.">
                <Button variant="seal" size="block" disabled={busy} onClick={() => act(`Judging ${id}`, "adjudicate_workflow", [id], {}, "Verdict sealed by validator consensus.",
                  (c) => !!c?.verdict && Object.keys(c.verdict).length > 0)}>Adjudicate now</Button>
              </ActionCard>
            )}

            {canDispute && (
              <ActionCard title="Open dispute" hint="One round only, before the settlement deadline. Reputation effects reverse until re-grading.">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Why is the verdict wrong?" className={`${input} mb-2`} />
                <Button variant="danger" size="block" disabled={busy} onClick={() => act(`Disputing ${id}`, "open_dispute", [id, note.trim()], {}, "Dispute opened. Reputation effects reversed.",
                  (c) => c?.status === "disputed")}>Dispute verdict</Button>
              </ActionCard>
            )}

            {canResolve && (
              <ActionCard title="Resolve dispute" hint="Re-runs judgment with the dispute note and fresh filings.">
                <Button variant="brass" size="block" disabled={busy} onClick={() => act(`Re-judging ${id}`, "resolve_dispute", [id], {}, "Dispute resolved with a fresh verdict.",
                  (c) => ["compliant", "breached"].includes(c?.status))}>Re-adjudicate</Button>
              </ActionCard>
            )}

            {canSettle && (
              <ActionCard title="Settle escrow" hint={`Anyone can trigger it. Pays ${card ? fmtGen(card.escrowed_atto) : ""} to the ${card?.verdict?.compliant ? "beneficiary" : "owner"}.`}>
                <Button variant="pine" size="block" disabled={busy || !settleReady} onClick={() => act(`Settling ${id}`, "settle_workflow", [id], {}, "Escrow released.",
                  (c) => !!c?.settled)}>
                  {settleReady ? `Release ${card ? fmtGen(card.escrowed_atto) : ""}` : `Opens in ${card ? fmtCountdown(card.settle_after) : ""}`}
                </Button>
              </ActionCard>
            )}

            {canExtend && (
              <ActionCard title="Extend deadline" hint="Deadlines only move forward, never back.">
                <div className="flex gap-2">
                  <input value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} type="datetime-local" aria-label="New deadline" className="w-full rounded-sm border border-parchment/20 bg-ink px-3 py-2 text-sm" />
                  <Button variant="ghost" size="sm" disabled={busy || !newDeadline} onClick={doExtend}>Extend</Button>
                </div>
              </ActionCard>
            )}

            {canRecover && (
              <ActionCard title="Recover escrow" hint="Only before any verdict: reclaim funds from quiet pacts so they never lock.">
                <Button variant="danger" size="block" disabled={busy} onClick={() => act(`Recovering ${id}`, "recover_escrow", [id], {}, "Escrow reclaimed by owner.",
                  (c) => !!c?.settled)}>Recover funds</Button>
              </ActionCard>
            )}

            {actionError && <p className="rounded-sm border border-seal/50 bg-sealdeep/20 px-3 py-2 text-sm text-seal" role="alert">{actionError}</p>}
            {actionOk && <p className="rounded-sm border border-pine/50 bg-pinedeep/30 px-3 py-2 text-sm text-pine" role="status">{actionOk}</p>}
          </aside>
        </div>
      )}
    </div>
  );
}
