"use client";

export type SealKind = "compliant" | "breached" | "disputed" | "open" | "settled" | "pending";

const INK: Record<SealKind, string> = {
  compliant: "#3FA46F",
  settled: "#3FA46F",
  breached: "#AE3226",
  disputed: "#C29B3C",
  open: "#C29B3C",
  pending: "#7D8B7A",
};

const LABEL: Record<SealKind, string> = {
  compliant: "Sealed",
  settled: "Settled",
  breached: "Breach",
  disputed: "Dispute",
  open: "Open",
  pending: "Pact",
};

export function Seal({
  kind = "pending",
  score = null,
  size = "md",
}: {
  kind?: SealKind;
  score?: number | string | null;
  size?: "sm" | "md" | "lg";
}) {
  const dims = size === "lg" ? "h-32 w-32" : size === "sm" ? "h-14 w-14" : "h-20 w-20";
  const labelCls = size === "lg" ? "text-xl" : size === "sm" ? "text-[10px]" : "text-xs";
  const subCls = size === "lg" ? "text-sm" : size === "sm" ? "text-[9px]" : "text-[10px]";
  return (
    <div
      className={`seal-stamp inline-flex items-center justify-center ${dims}`}
      style={{ color: INK[kind] }}
      role="img"
      aria-label={`Seal: ${LABEL[kind]}`}
    >
      <div className="flex h-full w-full items-center justify-center rounded-full border-2 p-1" style={{ borderColor: "currentColor" }}>
        <div
          className="flex h-full w-full flex-col items-center justify-center rounded-full border px-2 text-center leading-none"
          style={{ borderColor: "currentColor" }}
        >
          <span className={`font-display font-bold uppercase ${labelCls}`}>{LABEL[kind]}</span>
          {score !== null && score !== undefined && score !== "" && (
            <span className={`mt-1 font-mono ${subCls}`}>{String(score)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
