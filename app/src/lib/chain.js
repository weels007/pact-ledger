// genlayer-js client singleton + read/write helpers with friendly errors.
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { CONTRACT_ADDRESS } from "../config.js";
import { genlayerAccount } from "./wallet.js";

let client = null;

export function getClient() {
  if (!client) client = createClient({ chain: studionet });
  return client;
}

export function getAuthedClient() {
  const account = genlayerAccount();
  if (!account) throw new Error("Wallet is locked. Connect a wallet first.");
  return createClient({ chain: studionet, account });
}

export async function read(method, args = []) {
  const c = getClient();
  return c.readContract({ address: CONTRACT_ADDRESS, functionName: method, args });
}

// Sends a write tx. onHash fires as soon as the tx hash exists so the UI
// can track it. valueAtto is a bigint for payable methods.
export async function write(method, args = [], { valueAtto = 0n, onHash = null } = {}) {
  const c = getAuthedClient();
  const call = { address: CONTRACT_ADDRESS, functionName: method, args };
  if (valueAtto > 0n) call.value = valueAtto;
  const hash = await c.writeContract(call);
  if (onHash) onHash(hash);
  const receipt = await c.waitForTransactionReceipt({
    hash,
    status: "FINALIZED",
    retries: 90,
  });
  return { hash, receipt };
}

function receiptText(receipt) {
  try {
    return JSON.stringify(receipt, (_, v) => (typeof v === "bigint" ? v.toString() : v));
  } catch {
    return "";
  }
}

// Returns { ok, detail } — ok means leader execution succeeded on-chain.
// Note: rotation rounds also record ERROR entries, so success is judged by
// the presence of at least one SUCCESS, not the absence of errors.
export function executionOutcome(receipt) {
  const text = receiptText(receipt);
  const errors = (text.match(/execution_result[^,]*ERROR/g) || []).length;
  const successes = (text.match(/SUCCESS/g) || []).length;
  const contractError = /\[EXPECTED\]\s*([^"\\]+)/.exec(text);
  return {
    ok: successes > 0,
    successes,
    errors,
    expectedMessage: contractError ? contractError[1].trim() : null,
    // Undetermined = finalized but no state changed.
    undetermined: successes === 0,
  };
}

export function friendlyError(err) {
  const msg = err?.shortMessage || err?.details || err?.message || String(err);
  if (/insufficient|balance/i.test(msg)) return "Insufficient GEN balance for this transaction.";
  if (/rejected|denied/i.test(msg)) return "Signature rejected in wallet.";
  if (/fetch|network|timeout/i.test(msg)) return "Network hiccup reaching studionet. Wait a moment and retry.";
  return msg.length > 220 ? msg.slice(0, 220) + "…" : msg;
}
