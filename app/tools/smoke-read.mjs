// Smoke test: exercises the exact read shapes the frontend uses.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const G = "D:/Genlayer-project/weels/pact-ledger/app/node_modules/";
const gljs = await import("file:///" + G + "genlayer-js/dist/index.js");
const chains = await import("file:///" + G + "genlayer-js/dist/chains/index.js");
const { createClient } = gljs;
const client = createClient({ chain: chains.studionet });
const C = "0x61b394E81dF130fCF6990bEc17ac32515864Af54";
const j = (v) => JSON.stringify(v, (k, x) => (typeof x === "bigint" ? x.toString() : x));

const ids = await client.readContract({ address: C, functionName: "list_workflows", args: [] });
console.log("IDS=" + j(ids));
const card = await client.readContract({ address: C, functionName: "get_verdict_card", args: ["wfB"] });
console.log("CARD_STATUS=" + card.status + " ESCROW=" + card.escrowed_atto + " SCORE=" + (card.verdict && card.verdict.score));
const page = await client.readContract({ address: C, functionName: "get_evidence_page", args: ["wfB", 0, 2] });
console.log("PAGE_TOTAL=" + page.total + " LIMIT=" + page.limit);
const eq = await client.readContract({ address: C, functionName: "get_equivalence_info", args: [] });
console.log("EQ_METHOD=" + eq.method);
console.log("SMOKE_OK");
