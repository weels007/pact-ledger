import { NextResponse } from "next/server";
import { CONTRACT_ADDRESS } from "@/lib/config";

// Slim consensus trail per workflow, sourced from the Studio explorer API
// (server-side: no browser CORS issue). Display-only: the method is matched
// at the calldata ASCII tail and the workflow id as a standalone token —
// good enough for a UI trail, never used for consensus.
const EXPLORER_API = "https://explorer-studio.genlayer.com/api/transactions";
const CACHE_MS = 60_000;

export interface SlimTx {
  hash: string;
  kind: string;
  method: string | null;
  status: string;
  exec: string | null;
  agree: number;
  disagree: number;
  idle: number;
  rotations: number;
  appealed: boolean;
  time: string;
  value: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fullCache: { t: number; list: any[] } | null = null;

const METHODS = [
  "register_workflow",
  "submit_evidence",
  "adjudicate_workflow",
  "open_dispute",
  "resolve_dispute",
  "settle_workflow",
  "fund_workflow",
  "extend_deadline",
  "recover_escrow",
];

function asciiText(b64: string): string {
  try {
    return Buffer.from(b64, "base64").toString("latin1").replace(/[^\x20-\x7e]/g, " ");
  } catch {
    return "";
  }
}

function methodOf(b64: string | null): string | null {
  if (!b64) return null;
  const tail = asciiText(b64).trimEnd();
  for (const m of METHODS) {
    if (tail.endsWith(m)) return m;
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function slim(tx: any, workflowId: string): SlimTx | null {
  const cd = tx?.data?.calldata;
  const text = asciiText(typeof cd === "string" ? cd : "");
  if (!text.split(/[^A-Za-z0-9_-]+/).includes(workflowId)) return null;
  const votes = tx?.consensus_data?.votes;
  let agree = 0,
    disagree = 0,
    idle = 0;
  if (votes && typeof votes === "object") {
    for (const v of Object.values(votes)) {
      if (v === "agree") agree++;
      else if (v === "disagree") disagree++;
      else idle++;
    }
  }
  const lr = tx?.consensus_data?.leader_receipt;
  const exec = Array.isArray(lr) && lr.length > 0 ? String(lr[0]?.execution_result ?? "") || null : null;
  const from = String(tx.from_address || "").toLowerCase();
  return {
    hash: String(tx.hash),
    kind: tx.type === 1 ? "deploy" : from === CONTRACT_ADDRESS.toLowerCase() ? "send" : "call",
    method: methodOf(typeof cd === "string" ? cd : null),
    status: String(tx.status),
    exec,
    agree,
    disagree,
    idle,
    rotations: Number(tx.rotation_count || 0),
    appealed: !!tx.appealed,
    time: String(tx.created_at || ""),
    value: String(tx.value ?? "0"),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const workflowId = (searchParams.get("workflow") || "").trim();
  if (!workflowId) return NextResponse.json({ error: "missing ?workflow=" }, { status: 400 });

  const now = Date.now();
  if (!fullCache || now - fullCache.t >= CACHE_MS) {
    const upstream = await fetch(`${EXPLORER_API}?address=${CONTRACT_ADDRESS}&limit=100`, {
      cache: "no-store",
    });
    if (!upstream.ok) return NextResponse.json({ error: `explorer ${upstream.status}` }, { status: 502 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (await upstream.json()) as any;
    fullCache = { t: now, list: Array.isArray(body.transactions) ? body.transactions : [] };
  }
  const out: SlimTx[] = [];
  for (const tx of fullCache.list) {
    const s = slim(tx, workflowId);
    if (s) out.push(s);
  }
  return NextResponse.json({ txs: out });
}
