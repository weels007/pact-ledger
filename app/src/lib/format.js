// Small formatting helpers. All on-chain integers arrive as bigint or
// string; amounts are atto-GEN (1 GEN = 1e18).
const ATTO = 10n ** 18n;

export function toStr(v) {
  if (typeof v === "bigint") return v.toString();
  return String(v ?? "");
}

export function toNum(v, fallback = 0) {
  const n = Number(toStr(v));
  return Number.isFinite(n) ? n : fallback;
}

export function fmtGen(atto) {
  try {
    const v = typeof atto === "bigint" ? atto : BigInt(toStr(atto) || "0");
    const whole = v / ATTO;
    const frac = v % ATTO;
    if (frac === 0n) return `${whole} GEN`;
    const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "").slice(0, 4);
    return `${whole}.${fracStr} GEN`;
  } catch {
    return "0 GEN";
  }
}

export function genToAtto(gen) {
  const [w = "0", f = ""] = String(gen).split(".");
  const frac = (f + "0".repeat(18)).slice(0, 18);
  return BigInt(w || "0") * ATTO + BigInt(frac || "0");
}

export function shortHash(h, n = 6) {
  const s = toStr(h);
  if (s.length <= n * 2 + 2) return s;
  return `${s.slice(0, n + 2)}…${s.slice(-n)}`;
}

export function fmtUnix(sec) {
  const n = toNum(sec, 0);
  if (!n) return "—";
  return new Date(n * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtCountdown(targetSec) {
  const diff = toNum(targetSec, 0) - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "ready";
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function datetimeLocalToUnix(v) {
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? Math.floor(t / 1000) : 0;
}
