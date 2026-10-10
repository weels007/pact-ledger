// Fund a PactLedger workflow with GEN via the payable fund_workflow method.
// Usage (PowerShell):
//   $env:KSPW="keystore-password"
//   $env:NODE_PATH="C:\Users\dhozi\AppData\Roaming\npm\node_modules\genlayer\node_modules"
//   node tools/fund.mjs <contract> <workflowId> <amountGen>
// Reads keystore from D:\Genlayer-project\weels\wallet\pactledger-keystore.json
// Password is NEVER stored in this file (env only).
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const G = "C:/Users/dhozi/AppData/Roaming/npm/node_modules/genlayer/node_modules/";
const gljs = await import("file:///" + G + "genlayer-js/dist/index.js");
const { createClient, createAccount } = gljs;
const chains = await import("file:///" + G + "genlayer-js/dist/chains/index.js");
const { studionet } = chains;
const { ethers } = require(G + "ethers");
const fs = require("fs");

const [contract, workflowId, amountGen] = process.argv.slice(2);
if (!contract || !workflowId || !amountGen) {
  console.error("usage: node tools/fund.mjs <contract> <workflowId> <amountGen>");
  process.exit(1);
}
const ksPath =
  "D:/Genlayer-project/weels/wallet/pactledger-keystore.json";
const wallet = await ethers.Wallet.fromEncryptedJson(
  fs.readFileSync(ksPath, "utf8"),
  process.env.KSPW
);
const account = createAccount(wallet.privateKey);
const client = createClient({ chain: studionet, account });
const value = BigInt(Math.round(Number(amountGen) * 1e18));
const call = {
  address: contract,
  functionName: "fund_workflow",
  args: [workflowId],
  value,
};
let fees;
try {
  const est = await client.estimateTransactionFeesForWrite(call);
  fees = { distribution: est.distribution, feeValue: est.feeValue };
} catch (e) {
  console.log("FEE_ESTIMATE_SKIPPED=" + (e && e.message ? e.message : e));
}
const tx = await client.writeContract(fees ? { ...call, fees } : call);
console.log("FUND_TX=" + tx);
const receipt = await client.waitForTransactionReceipt({
  hash: tx,
  status: "FINALIZED",
  retries: 80,
});
console.log("STATUS=" + (receipt.status_name || receipt.status));
const s = JSON.stringify(receipt, (k, v) => (typeof v === "bigint" ? v.toString() : v));
console.log("SUCCESS_COUNT=" + (s.match(/SUCCESS/g) || []).length);
console.log("ERROR_COUNT=" + (s.match(/execution_result[^,]*ERROR/g) || []).length);
