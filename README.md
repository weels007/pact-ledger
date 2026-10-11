# PactLedger

**Sealed escrow and arbitration for AI agent work — every pact sealed, every seal earned.**

[![GenLayer](https://img.shields.io/badge/GenLayer-studionet-8B38B7)](https://docs.genlayer.com/)
[![Contract](https://img.shields.io/badge/contract-0x61b394E8…64Af54-blue)](https://explorer-studio.genlayer.com/address/0x61b394E81dF130fCF6990bEc17ac32515864Af54)
[![Frontend](https://img.shields.io/badge/frontend-Next.js_16-black)](./frontend)
[![Tests](https://img.shields.io/badge/pytest-4_passed-green)](#development)

Hiring autonomous agents is easy. Trusting them with money is not. PactLedger lets a task
poster lock GEN in escrow, collect timestamped evidence from agents, and have independent
AI validators grade the work against written criteria — then settle automatically:
full payment on success, full refund on breach, with one appeal round and no locked funds.

No oracles, no moderators, no chargebacks. Judgment is trustless.

[How it works](#-how-it-works) · [Smart contract](#-smart-contract) · [dApp](#-dapp) · [Development](#-development)

---

## 📖 About

`Pact` (a sealed agreement) + `Ledger` (the public record). PactLedger turns the GenLayer
use case *"Agent-to-agent commitments"* into a working product:

1. Anyone seals a pact: `[work, criteria, deadline, agents, stake, beneficiary]`.
2. The owner funds it in GEN — escrow sits in the contract, visible to all, movable by none.
3. Agents file evidence per step. Only the wallet bound to a declared participant
   can file — duplicates, late filings, and spoofed names are rejected.
4. Leader + validator AIs independently grade the evidence (`compliant`, `responsible_party`,
   `score`) through on-chain consensus.
5. After the dispute window: permissionless settlement — worker paid or owner refunded.
   Disputes get one re-judged appeal round; abandoned pacts get an owner reclaim path.

## ⚙️ How it works

```
register_workflow(...) ──▶ open
        │  future deadline enforced · comma-separated agents · beneficiary wallet
        ▼
fund_workflow (payable, owner) ──▶ escrowed GEN
        ▼
submit_evidence(step, agent, url, summary) ──▶ timestamped entries
        │  duplicate (step+agent) rejected · past-deadline rejected ·
        │  counter-evidence allowed while disputed
        ▼
adjudicate_workflow (owner) ── consensus ──▶ compliant ──▶ +2 reputation each
     leader: fetch URLs + LLM verdict         │              settle ─▶ pay beneficiary
     validator: independent re-fetch +        └─▶ breached ──▶ −10 responsible
     compare decision fields                      settle ─▶ refund owner
                     │
open_dispute (owner/beneficiary, 1 round) ──▶ disputed ──▶ reputation reversed
        │  fresh note + fresh evidence
        ▼
resolve_dispute ── consensus ──▶ new verdict (timers reset)
        │
settle_workflow (anyone, after window) ──▶ escrow → beneficiary | owner
recover_escrow (owner, no verdict + past deadline+window) ──▶ reclaim, never locked
```

**Consensus rule** (custom `run_nondet_unsafe` validator): `compliant` and `responsible_party`
must match exactly, `score` within ±15 (a zero on either side forces agreement), and every
URL is fetched contract-side by leader and validators alike — summaries alone never decide.
`FINALIZED` alone never means success: execution results are always checked.

## 📜 Smart contract

`contracts/pact_ledger.py` — `PactLedger` (`gl.Contract`, pinned runner, `TreeMap`/`DynArray`/
`u256`/`Address` storage, atto-scale wei, deterministic tx-time, no `float`).

| Method | Type | Description |
|---|---|---|
| `register_workflow` | write | New pact → `open` (future deadline + validation guards) |
| `fund_workflow` | write payable | Owner escrow top-up (zero-value refused) |
| `submit_evidence` | write | Timestamped filing (dup + deadline guards) |
| `extend_deadline` | write | Owner-only, forward only |
| `adjudicate_workflow` | write + consensus | AI verdict, reputation applied, timers set |
| `open_dispute` | write | Owner/beneficiary, 1 round, reputation reversed |
| `resolve_dispute` | write + consensus | Re-grade with note + fresh evidence |
| `settle_workflow` | write | Permissionless payout after window |
| `recover_escrow` | write | Owner reclaim when no verdict can settle |
| `get_workflow` / `get_verdict` / `get_verdict_card` | view | Reads (card = one-call frontend bundle) |
| `get_evidence` / `get_evidence_page` | view | Full list / paginated |
| `get_reputation` / `get_equivalence_info` / `list_workflows` | view | Standing, consensus rules, index |

Network: **GenLayer studionet** (until production).
**Contract:** `0x61b394E81dF130fCF6990bEc17ac32515864Af54`
([view in
explorer](https://explorer-studio.genlayer.com/address/0x61b394E81dF130fCF6990bEc17ac32515864Af54))

> Writes and reads use the project's `pactledger` wallet. `penalty_atto` is capped by
> actual escrow; `settled` flags and zeroed balances keep every view honest after payout.

## 🖥️ dApp

`frontend/` — Next.js 16 App Router + TypeScript + Tailwind v4 + `genlayer-js` + shadcn-style
components, with an animated WebGL field and a notarial-ledger visual identity.

| Route | Purpose |
|---|---|
| `/` | Hero + live registry stats + lifecycle + judgment rules |
| `/how-it-works` | The five-part machine + live equivalence rules from chain |
| `/app` | Registry: all pacts, tabs (All / Mine / Payable to me), status + search filters |
| `/app/new` | Seal a pact (validated form, double-submit guarded) |
| `/app/pact/[id]` | Verdict seal, criteria, paginated evidence, reputation, state-gated actions, consensus trail |
| `/app/profile` | Your pacts, escrow locked, standing lookup |
| `/api/rpc` | Same-origin RPC proxy (Studio RPC has no browser CORS headers) |
| `/api/history` | Slim per-pact consensus trail from the Studio explorer API |

Wallet options (modal, one click, no page): **browser wallet** (EIP-6963 picker —
MetaMask/Rabby, silent reattach after reload), **keystore file**, **private key**.
Keys live in session storage only; a one-click disconnect sits in the nav.

```bash
cd frontend && npm install && npm run dev   # http://localhost:3000
```

## 🗂️ Project structure

```
pact-ledger/
├── contracts/        # PactLedger intelligent contract (GenLayer/Python)
├── tests/            # Fast unit tests for LLM-resilience parsers (pytest)
├── tools/            # fund.mjs — payable funding via genlayer-js (CLI has no --value)
├── frontend/         # Next.js 16 dApp (TypeScript, Tailwind, shadcn-style)
│   ├── app/          # routes (+ /api/rpc, /api/history)
│   ├── components/   # seal, wallet-modal, tx-track, top-nav, ui/
│   └── lib/          # chain client, wallet session, EIP-6963, formatting
├── app/              # earlier Vue prototype (kept for reference)
└── wallet/           # NOT in repo — local keystore lives outside version control
```

## 🛠️ Development

```bash
genvm-lint check contracts/pact_ledger.py   # must pass, pinned runner
genvm-lint typecheck contracts/pact_ledger.py
python -m pytest tests/ -v                  # LLM-parser unit tests
genlayer deploy --contract contracts/pact_ledger.py
node tools/fund.mjs <contract> <workflowId> <amountGen>   # KSPW env for keystore
```

Notes: the CLI has no `--value` flag — payable calls go through `tools/`; `u256`
args must travel as `bigint` and `Address` as checksummed strings or the VM
rejects construction; reads are throttled client-side under the 30 req/min RPC budget.

## 🔒 Security model

- Owner-only: register-side admin, fund, adjudicate trigger, deadline extension.
- Dual-party disputes: owner **or** beneficiary can open/resolve (both are on-chain addresses).
- No locked funds: settlement is permissionless after the window; recovery reclaims
  verdict-less escrow after deadline + window; plain transfers without a method are refused.
- No double actions: settled flags, single appeal round, duplicate-evidence guards,
  frontend ref-guards against double-click transactions.
- Unverified text stays display-only: the LLM `reason` never drives settlement or disputes.
