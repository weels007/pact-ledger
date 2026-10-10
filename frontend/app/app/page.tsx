"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Seal, type SealKind } from "@/components/seal";
import { read, readMany } from "@/lib/chain";
import { fmtCountdown, fmtGen } from "@/lib/format";
import { getAddress } from "@/lib/wallet";

type Tab = "all" | "mine" | "forme";
type StatusF = "all" | "open" | "disputed" | "compliant" | "breached" | "settled";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sealKind(r: any): SealKind {
  if (r.settled) return "settled";
  if (r.status === "disputed") return "disputed";
  if (r.verdict && Object.keys(r.verdict).length > 0) return r.verdict.compliant ? "compliant" : "breached";
  return "open";
}

function statusWord(status: string): string {
  return ({ open: "taking filings", disputed: "under dispute", compliant: "passed", breached: "failed" } as Record<string, string>)[status] || status;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowNote(r: any): string {
  const judged = r.verdict && Object.keys(r.verdict).length > 0;
  if (!judged) return statusWord(r.status);
  if (!r.settled && fmtCountdown(r.settle_after) === "ready") return `${statusWord(r.status)} · settleable`;
  return statusWord(r.status);
}

export default function Registry() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [status, setStatus] = useState<StatusF>("all");
  const [query, setQuery] = useState("");
  const [me, setMe] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const ids = (await read("list_workflows")) as string[];
      const list = (Array.isArray(ids) ? ids : []).slice().reverse();
      const cards = await readMany<Record<string, unknown>>(list.map((id) => ({ method: "get_verdict_card", args: [id] })));
      const out = [];
      for (const card of cards) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = card as any;
        if (c && c.workflow_id) out.push(c);
      }
      setRows(out);
    } catch {
      setError("Registry unreachable. The chain may be busy — retry in a moment.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMe((getAddress() || "").toLowerCase());
    load();
  }, []);

  const visible = rows.filter((r) => {
    if (tab === "mine" && String(r.owner || "").toLowerCase() !== me) return false;
    if (tab === "forme" && String(r.beneficiary || "").toLowerCase() !== me) return false;
    if (status === "settled" && !r.settled) return false;
    if (status !== "all" && status !== "settled" && r.status !== status) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      if (!String(r.workflow_id).toLowerCase().includes(q) && !String(r.description).toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="rise-in mx-auto max-w-[1520px] px-4 py-10">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-brass">Registry</p>
          <h1 className="mt-2 font-display text-4xl font-bold">Every pact on record</h1>
        </div>
        <Link href="/app/new" className="ml-auto rounded-sm bg-seal px-4 py-2 text-sm font-semibold text-parchment hover:bg-sealdeep">
          + New pact
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-sm border border-parchment/15 p-1 text-sm">
          {(["all", "mine", "forme"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-sm px-3 py-1.5 ${tab === t ? "bg-ink3 text-parchment" : "text-parchdim hover:text-parchment"}`}
            >
              {t === "all" ? "All pacts" : t === "mine" ? "Mine" : "Payable to me"}
            </button>
          ))}
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusF)}
          aria-label="Filter by status"
          className="rounded-sm border border-parchment/15 bg-ink px-3 py-2 text-sm text-parchdim"
        >
          {(["all", "open", "disputed", "compliant", "breached", "settled"] as StatusF[]).map((s) => (
            <option key={s} value={s}>{s === "all" ? "Any status" : s}</option>
          ))}
        </select>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search id or description…"
          aria-label="Search pacts"
          className="w-full rounded-sm border border-parchment/15 bg-ink px-3 py-2 text-sm sm:w-64"
        />
        {(tab === "mine" || tab === "forme") && !me && (
          <span className="text-xs text-brass">Connect a wallet to use this tab.</span>
        )}
      </div>

      {loading ? (
        <div className="mt-8 space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-md bg-ink2"></div>
          ))}
        </div>
      ) : error ? (
        <p className="mt-8 rounded-sm border border-seal/50 bg-sealdeep/20 px-4 py-3 text-sm text-seal" role="alert">
          {error} <button className="ml-2 underline underline-offset-2" onClick={load}>Retry</button>
        </p>
      ) : rows.length === 0 ? (
        <div className="mt-8 rounded-md border border-dashed border-parchment/25 px-6 py-14 text-center">
          <div className="mx-auto w-fit opacity-80"><Seal kind="pending" size="md" /></div>
          <p className="mt-4 font-display text-2xl font-semibold">The registry is empty.</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-parchdim">No pacts sealed yet. Write the first one — criteria, stake, deadline — and put agents to work.</p>
          <Link href="/app/new" className="mt-6 inline-block rounded-sm bg-seal px-5 py-2.5 text-sm font-semibold text-parchment hover:bg-sealdeep">
            Seal the first pact
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-8 rounded-md border border-dashed border-parchment/25 px-6 py-10 text-center text-sm text-parchdim">
          No pacts match this filter. Try another tab, status, or search.
        </p>
      ) : (
        <div className="mt-8 overflow-hidden rounded-md border border-parchment/10">
          {visible.map((r) => (
            <Link
              key={r.workflow_id}
              href={`/app/pact/${r.workflow_id}`}
              className="ledger-row grid items-center gap-3 bg-ink2/60 px-4 py-4 transition hover:bg-ink2 md:grid-cols-[auto_1fr_auto_auto_auto]"
            >
              <Seal kind={sealKind(r)} score={r.verdict?.score ?? null} size="sm" />
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold">{r.description}</p>
                <p className="mt-0.5 font-mono text-[11px] text-sage">
                  {r.workflow_id} · {String(r.evidence_count)} filings · {rowNote(r)}
                </p>
              </div>
              <span className="font-mono text-xs text-brass">{fmtGen(r.escrowed_atto)} escrow</span>
              <span className={`font-mono text-xs ${r.settled ? "text-pine" : "text-parchdim"}`}>{r.settled ? "settled" : r.status}</span>
              <span className="font-mono text-xs text-brass underline underline-offset-4">Detail →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
