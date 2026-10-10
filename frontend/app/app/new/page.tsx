"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/components/wallet-modal";
import { useTx } from "@/components/tx-track";
import { executionOutcome, friendlyError, read, write } from "@/lib/chain";
import { datetimeLocalToUnix, genToAtto, toCalldataAddress } from "@/lib/format";
import { getAddress } from "@/lib/wallet";

export default function NewPact() {
  const router = useRouter();
  const wallet = useWallet();
  const tx = useTx();
  const [f, setF] = useState({
    id: "",
    description: "",
    criteria: "",
    deadline: "",
    window: "86400",
    participants: "",
    penalty: "1",
    beneficiary: getAddress() || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submittingRef = useRef(false);

  const set = (k: string, v: string) => setF((prev) => ({ ...prev, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!getAddress()) {
      wallet.open();
      return;
    }
    submittingRef.current = true;
    setBusy(true);
    setError("");
    const id = f.id.trim();
    const tracker = tx.push({ title: `Sealing pact ${id}`, hash: "…" });
    try {
      // u256 params must travel as bigint, not string — the VM calls
      // .to_bytes() on them and a raw string crashes construction.
      // Same for Address: checksummed, validated before sending.
      const rawBeneficiary = f.beneficiary.trim() || getAddress() || "";
      let beneficiary;
      try {
        beneficiary = toCalldataAddress(rawBeneficiary);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Invalid beneficiary address.");
        return;
      }
      const { hash, receipt } = await write(
        "register_workflow",
        [
          id,
          f.description.trim(),
          f.criteria.trim(),
          BigInt(datetimeLocalToUnix(f.deadline)),
          f.participants.trim(),
          genToAtto(f.penalty),
          beneficiary,
          BigInt(Number(f.window)),
        ],
        { onHash: (h) => tx.update(tracker, { hash: h }) }
      );
      const out = executionOutcome(receipt);
      if (out.expectedMessage) {
        tx.update(tracker, { tone: "bad", note: `Rejected: ${out.expectedMessage}` });
        setError(`Rejected: ${out.expectedMessage}`);
        return;
      }
      // Ground truth is chain state, not receipt parsing: confirm the pact
      // exists before declaring success.
      try {
        const check = await read("get_workflow", [id]);
        if (!check || !check.workflow_id) throw new Error("missing");
      } catch {
        tx.update(tracker, { tone: "bad", note: "Finalized without visible effect — check the registry before retrying (do not resubmit blindly)." });
        setError("The transaction finalized but the pact is not visible yet. Check the registry — it may appear shortly — before submitting again.");
        return;
      }
      tx.update(tracker, { tone: "good", hash, note: "Pact sealed in the registry." });
      router.push(`/app/pact/${id}`);
    } catch (err) {
      const msg = friendlyError(err);
      tx.update(tracker, { tone: "bad", note: msg });
      setError(msg);
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }

  const input = "mt-1.5 w-full rounded-sm border border-parchment/20 bg-ink px-3 py-2 text-sm";

  return (
    <div className="rise-in mx-auto max-w-3xl px-4 py-10">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-brass">New pact</p>
      <h1 className="mt-2 font-display text-4xl font-bold">Write it precisely.</h1>
      <p className="mt-2 text-sm text-parchdim">Vague pacts make weak verdicts. Validators grade only against what you write here.</p>

      <form className="mt-8 space-y-5 rounded-md border border-parchment/10 bg-ink2 p-6" onSubmit={submit}>
        <div>
          <label className="text-xs text-parchdim" htmlFor="wid">Pact ID — short, unique, no spaces</label>
          <input id="wid" value={f.id} onChange={(e) => set("id", e.target.value)} required pattern="[A-Za-z0-9_-]+" placeholder="website-relaunch-01" className={`${input} font-mono`} />
        </div>
        <div>
          <label className="text-xs text-parchdim" htmlFor="desc">Work description</label>
          <textarea id="desc" value={f.description} onChange={(e) => set("description", e.target.value)} required rows={2} placeholder="What exactly must be delivered?" className={input} />
        </div>
        <div>
          <label className="text-xs text-parchdim" htmlFor="crit">Acceptance criteria — the grading rubric</label>
          <textarea id="crit" value={f.criteria} onChange={(e) => set("criteria", e.target.value)} required rows={3} placeholder="Must include…, must do…, must not…" className={input} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-parchdim" htmlFor="dl">Submission deadline</label>
            <input id="dl" value={f.deadline} onChange={(e) => set("deadline", e.target.value)} type="datetime-local" required className={input} />
          </div>
          <div>
            <label className="text-xs text-parchdim" htmlFor="win">Dispute window</label>
            <select id="win" value={f.window} onChange={(e) => set("window", e.target.value)} className={input}>
              <option value="300">5 minutes (demo)</option>
              <option value="3600">1 hour</option>
              <option value="86400">24 hours (recommended)</option>
              <option value="604800">7 days</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-parchdim" htmlFor="parts">Agents — comma separated names</label>
          <input id="parts" value={f.participants} onChange={(e) => set("participants", e.target.value)} required placeholder="agent-alpha,agent-beta" className={`${input} font-mono`} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs text-parchdim" htmlFor="pen">Stake / penalty (GEN)</label>
            <input id="pen" value={f.penalty} onChange={(e) => set("penalty", e.target.value)} required inputMode="decimal" pattern="[0-9]+(\.[0-9]+)?" placeholder="1" className={`${input} font-mono`} />
          </div>
          <div>
            <label className="text-xs text-parchdim" htmlFor="ben">Beneficiary wallet (0x…)</label>
            <input id="ben" value={f.beneficiary} onChange={(e) => set("beneficiary", e.target.value)} required pattern="0x[0-9a-fA-F]{40}" placeholder="0x…" className={`${input} font-mono`} />
          </div>
        </div>

        {error && <p className="rounded-sm border border-seal/50 bg-sealdeep/20 px-3 py-2 text-sm text-seal" role="alert">{error}</p>}

        <Button type="submit" variant="seal" size="block" disabled={busy}>
          {busy ? "Sealing on-chain…" : "Seal the pact"}
        </Button>
        <p className="text-center text-xs text-sage">Registration is a consensus transaction — it takes a few seconds to seal.</p>
      </form>
    </div>
  );
}
