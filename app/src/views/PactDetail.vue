<template>
  <div class="rise-in mx-auto max-w-6xl px-4 py-10">
    <RouterLink to="/app" class="font-mono text-xs text-brass hover:underline">← Registry</RouterLink>

    <div v-if="loading" class="mt-6 h-64 animate-pulse rounded-md bg-ink2"></div>
    <p v-else-if="error" class="mt-6 rounded-sm border border-seal/50 bg-sealdeep/20 px-4 py-3 text-sm text-seal" role="alert">
      {{ error }} <button class="ml-2 underline underline-offset-2" @click="load">Retry</button>
    </p>

    <div v-else-if="card" class="mt-4 grid gap-6 lg:grid-cols-[1fr_380px]">
      <!-- LEFT: pact paper -->
      <div class="min-w-0">
        <div class="flex flex-wrap items-start gap-5 rounded-md border border-parchment/10 bg-ink2 p-6">
          <Seal :kind="sealKind" :score="card.verdict?.score" size="lg" />
          <div class="min-w-0 flex-1">
            <p class="font-mono text-xs text-brass">{{ card.workflow_id }}</p>
            <h1 class="mt-1 font-display text-3xl font-bold leading-tight">{{ card.description }}</h1>
            <div class="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-parchdim">
              <span>Status: <b :class="statusCls">{{ card.status }}</b></span>
              <span>Escrow: <b class="text-brass">{{ fmtGen(card.escrowed_atto) }}</b></span>
              <span>Filings: {{ card.evidence_count }}</span>
              <span>Deadline: {{ fmtUnix(card.deadline_unix) }}</span>
            </div>
          </div>
        </div>

        <div class="mt-6 rounded-md border border-parchment/10 bg-ink2 p-6">
          <h2 class="font-mono text-[11px] uppercase tracking-[0.2em] text-brass">Acceptance criteria</h2>
          <p class="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{{ card.sla_criteria }}</p>
          <div class="mt-4 grid gap-3 font-mono text-xs text-parchdim sm:grid-cols-2">
            <p>Owner <span class="block truncate text-parchment">{{ card.owner }}</span></p>
            <p>Beneficiary <span class="block truncate text-parchment">{{ card.beneficiary }}</span></p>
            <p>Stake <span class="block text-parchment">{{ fmtGen(card.penalty_atto) }}</span></p>
            <p>Settle opens <span class="block text-parchment">{{ card.settle_after ? `${fmtUnix(card.settle_after)} (${fmtCountdown(card.settle_after)})` : "after judgment" }}</span></p>
          </div>
        </div>

        <div v-if="hasVerdict" class="mt-6 rounded-md border border-parchment/10 bg-ink2 p-6">
          <h2 class="font-mono text-[11px] uppercase tracking-[0.2em] text-brass">Sealed verdict</h2>
          <div class="mt-3 grid gap-4 sm:grid-cols-[auto_1fr]">
            <div class="font-display text-6xl font-bold" :class="card.verdict.compliant ? 'text-pine' : 'text-seal'">{{ card.verdict.score }}</div>
            <div>
              <p class="font-display text-xl font-semibold">{{ card.verdict.compliant ? "Compliant — work accepted" : "Breach" }}{{ card.verdict.compliant ? "" : ` — ${card.verdict.responsible_party} at fault` }}</p>
              <p class="mt-2 text-sm leading-relaxed text-parchdim">{{ card.verdict.reason }}</p>
              <p class="mt-2 font-mono text-xs text-sage">Penalty recorded: {{ fmtGen(card.verdict.penalty_applied_atto) }} · graded twice under ±15 consensus</p>
            </div>
          </div>
          <div v-if="card.dispute_note" class="mt-4 border-l-2 border-brass pl-3 text-sm italic text-parchdim">Dispute note: “{{ card.dispute_note }}”</div>
        </div>

        <div class="mt-6 rounded-md border border-parchment/10 bg-ink2 p-6">
          <div class="flex items-center justify-between">
            <h2 class="font-mono text-[11px] uppercase tracking-[0.2em] text-brass">Evidence filings ({{ page.total }})</h2>
            <div class="flex gap-2 text-xs">
              <button :disabled="page.offset === 0" class="rounded border border-parchment/20 px-2 py-1 disabled:opacity-40" @click="pageBy(-page.limit)">← Prev</button>
              <button :disabled="page.offset + page.limit >= page.total" class="rounded border border-parchment/20 px-2 py-1 disabled:opacity-40" @click="pageBy(page.limit)">Next →</button>
            </div>
          </div>
          <div class="mt-3 overflow-hidden rounded-sm border border-parchment/10">
            <div v-for="e in items" :key="e.step_id + e.agent + e.submitted_at" class="ledger-row px-4 py-3">
              <div class="flex flex-wrap items-baseline gap-x-3">
                <span class="font-mono text-xs text-brass">{{ e.step_id }}</span>
                <span class="text-sm font-semibold">{{ e.agent }}</span>
                <span v-if="e.dispute_phase" class="rounded-sm bg-brass/20 px-1.5 py-0.5 font-mono text-[10px] text-brass">dispute filing</span>
                <span class="ml-auto font-mono text-[11px] text-sage">{{ fmtUnix(e.submitted_at) }}</span>
              </div>
              <p class="mt-1 text-sm text-parchdim">{{ e.summary }}</p>
              <a v-if="e.evidence_url" :href="e.evidence_url" target="_blank" rel="noreferrer" class="mt-1 inline-block font-mono text-[11px] text-sage underline-offset-2 hover:text-parchment hover:underline">{{ e.evidence_url }} ↗</a>
            </div>
            <p v-if="items.length === 0" class="px-4 py-6 text-center text-sm text-sage">No filings yet — the first one sets the tone.</p>
          </div>
        </div>

        <div class="mt-6 rounded-md border border-parchment/10 bg-ink2 p-6">
          <h2 class="font-mono text-[11px] uppercase tracking-[0.2em] text-brass">Agent standing</h2>
          <div class="mt-3 flex flex-wrap gap-2">
            <span v-for="(score, name) in card.reputations" :key="name" class="rounded-sm border border-parchment/15 px-3 py-1.5 font-mono text-xs">
              {{ name }} · <b :class="score >= 100 ? 'text-pine' : 'text-seal'">{{ score }}</b>
            </span>
          </div>
        </div>
      </div>

      <!-- RIGHT: action rail, gated by pact state -->
      <aside class="space-y-4">
        <div v-if="!isAuthed" class="rounded-md border border-brass/40 bg-ink2 p-5 text-sm">
          <p class="font-display text-lg font-semibold">Reading is free. Acting needs keys.</p>
          <p class="mt-1 text-parchdim">Connect a wallet to fund, file, judge, or settle.</p>
          <RouterLink to="/app/connect" class="mt-4 block rounded-sm bg-brass px-4 py-2 text-center text-sm font-semibold text-ink">Connect wallet</RouterLink>
        </div>

        <ActionCard v-if="canFund" title="Fund escrow" hint="Top up any time before judgment. GEN moves straight into the contract.">
          <div class="flex gap-2">
            <input v-model="fundAmt" inputmode="decimal" pattern="[0-9]+(\.[0-9]+)?" class="w-full rounded-sm border border-parchment/20 bg-ink px-3 py-2 font-mono text-sm" placeholder="0.5" />
            <button :disabled="busy" class="rounded-sm bg-brass px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50" @click="doFund">Fund</button>
          </div>
        </ActionCard>

        <ActionCard v-if="canFile" title="File evidence" hint="One filing per step per agent. On-chain timestamp included automatically.">
          <input v-model="ev.step" class="mb-2 w-full rounded-sm border border-parchment/20 bg-ink px-3 py-2 font-mono text-sm" placeholder="step id, e.g. step-login" />
          <input v-model="ev.agent" class="mb-2 w-full rounded-sm border border-parchment/20 bg-ink px-3 py-2 font-mono text-sm" placeholder="agent name" />
          <input v-model="ev.url" class="mb-2 w-full rounded-sm border border-parchment/20 bg-ink px-3 py-2 font-mono text-sm" placeholder="https://… evidence URL" />
          <textarea v-model="ev.summary" rows="2" class="mb-2 w-full rounded-sm border border-parchment/20 bg-ink px-3 py-2 text-sm" placeholder="What was delivered?"></textarea>
          <button :disabled="busy" class="w-full rounded-sm border border-parchment/25 px-4 py-2 text-sm font-semibold disabled:opacity-50 hover:bg-ink3" @click="doFile">File evidence</button>
        </ActionCard>

        <ActionCard v-if="canJudge" title="Pass judgment" hint="Runs the full validator consensus. Takes a minute or two.">
          <button :disabled="busy" class="w-full rounded-sm bg-seal px-4 py-2 text-sm font-semibold text-parchment disabled:opacity-50" @click="doJudge">Adjudicate now</button>
        </ActionCard>

        <ActionCard v-if="canDispute" title="Open dispute" hint="One round only. Reputation effects reverse until re-grading.">
          <textarea v-model="note" rows="2" class="mb-2 w-full rounded-sm border border-parchment/20 bg-ink px-3 py-2 text-sm" placeholder="Why is the verdict wrong?"></textarea>
          <button :disabled="busy" class="w-full rounded-sm border border-brass/60 px-4 py-2 text-sm font-semibold text-brass disabled:opacity-50 hover:bg-brass hover:text-ink" @click="doDispute">Dispute verdict</button>
        </ActionCard>

        <ActionCard v-if="canResolve" title="Resolve dispute" hint="Re-runs judgment with the dispute note and fresh filings.">
          <button :disabled="busy" class="w-full rounded-sm bg-brass px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50" @click="doResolve">Re-adjudicate</button>
        </ActionCard>

        <ActionCard v-if="canSettle" title="Settle escrow" :hint="settleHint">
          <button :disabled="busy || !settleReady" class="w-full rounded-sm bg-pine px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50" @click="doSettle">
            {{ settleReady ? `Release ${fmtGen(card.escrowed_atto)}` : `Opens in ${fmtCountdown(card.settle_after)}` }}
          </button>
        </ActionCard>

        <ActionCard v-if="canRecover" title="Recover escrow" hint="No verdict and past deadline + window: reclaim funds so they never lock.">
          <button :disabled="busy" class="w-full rounded-sm border border-seal/60 px-4 py-2 text-sm font-semibold text-seal disabled:opacity-50 hover:bg-seal hover:text-parchment" @click="doRecover">Recover funds</button>
        </ActionCard>

        <p v-if="actionError" class="rounded-sm border border-seal/50 bg-sealdeep/20 px-3 py-2 text-sm text-seal" role="alert">{{ actionError }}</p>
        <p v-if="actionOk" class="rounded-sm border border-pine/50 bg-pinedeep/30 px-3 py-2 text-sm text-pine" role="status">{{ actionOk }}</p>
      </aside>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import Seal from "../components/Seal.vue";
import ActionCard from "../components/ActionCard.vue";
import { store } from "../main.js";
import { read, write, executionOutcome, friendlyError } from "../lib/chain.js";
import { fmtCountdown, fmtGen, fmtUnix, genToAtto, toNum } from "../lib/format.js";
import { getAddress } from "../lib/wallet.js";

const props = defineProps({ id: { type: String, required: true } });

const card = ref(null);
const loading = ref(true);
const error = ref("");
const busy = ref(false);
const actionError = ref("");
const actionOk = ref("");
const fundAmt = ref("0.5");
const ev = ref({ step: "", agent: "", url: "", summary: "" });
const note = ref("");
const page = ref({ total: 0, offset: 0, limit: 5 });
const items = ref([]);

const me = computed(() => (getAddress() || "").toLowerCase());
const isAuthed = computed(() => !!me.value);
const isOwner = computed(() => card.value && me.value && card.value.owner?.toLowerCase() === me.value);
const isBeneficiary = computed(() => card.value && me.value && card.value.beneficiary?.toLowerCase() === me.value);
const hasVerdict = computed(() => {
  const v = card.value?.verdict;
  return !!v && Object.keys(v).length > 0;
});

const sealKind = computed(() => {
  if (!card.value) return "pending";
  if (card.value.settled) return "settled";
  if (card.value.status === "disputed") return "disputed";
  if (hasVerdict.value) return card.value.verdict.compliant ? "compliant" : "breached";
  return "open";
});
const statusCls = computed(() =>
  card.value?.status === "breached" ? "text-seal" : card.value?.status === "compliant" ? "text-pine" : "text-brass"
);

const canFund = computed(() => isOwner.value && card.value?.status === "open" && !card.value?.settled);
const canFile = computed(() => isAuthed.value && ["open", "disputed"].includes(card.value?.status) && !card.value?.settled);
const canJudge = computed(() => isOwner.value && card.value?.status === "open" && toNum(card.value?.evidence_count) > 0);
const canDispute = computed(() => (isOwner.value || isBeneficiary.value) && ["compliant", "breached"].includes(card.value?.status) && !card.value?.settled && toNum(card.value?.appeal_count) < 1);
const canResolve = computed(() => (isOwner.value || isBeneficiary.value) && card.value?.status === "disputed");
const canSettle = computed(() => isAuthed.value && ["compliant", "breached"].includes(card.value?.status) && !card.value?.settled);
const settleReady = computed(() => {
  if (!card.value?.settle_after) return false;
  return Math.floor(Date.now() / 1000) >= toNum(card.value.settle_after);
});
const settleHint = computed(() => {
  if (!card.value) return "";
  const to = card.value.verdict?.compliant ? "beneficiary" : "owner";
  return `Anyone can trigger it. Pays ${fmtGen(card.value.escrowed_atto)} to the ${to}.`;
});
const canRecover = computed(() => isOwner.value && !card.value?.settled && ["open", "disputed"].includes(card.value?.status));

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const c = await read("get_verdict_card", [props.id]);
    if (!c || !c.workflow_id) throw new Error("empty");
    card.value = c;
    await loadPage(0);
  } catch {
    error.value = "Pact not found or chain unreachable.";
  } finally {
    loading.value = false;
  }
}

async function loadPage(offset) {
  try {
    const p = await read("get_evidence_page", [props.id, offset, 5]);
    page.value = { total: toNum(p.total), offset: toNum(p.offset), limit: toNum(p.limit) };
    items.value = JSON.parse(p.items_json || "[]");
  } catch {
    items.value = [];
  }
}
function pageBy(delta) {
  loadPage(Math.max(0, page.value.offset + delta));
}

async function act(title, method, args, opts, doneMsg) {
  busy.value = true;
  actionError.value = "";
  actionOk.value = "";
  const tracker = store.tx?.push({ title, hash: "…" });
  try {
    const { hash, receipt } = await write(method, args, {
      ...opts,
      onHash: (h) => store.tx?.update(tracker, { hash: h }),
    });
    const out = executionOutcome(receipt);
    if (!out.ok) {
      const msg = out.expectedMessage ? `Rejected: ${out.expectedMessage}` : "Finalized without effect — validators could not agree. Nothing changed.";
      store.tx?.update(tracker, { tone: "bad", hash, note: msg });
      actionError.value = msg;
      return;
    }
    store.tx?.update(tracker, { tone: "good", hash, note: doneMsg });
    actionOk.value = doneMsg;
    await load();
  } catch (e) {
    const msg = friendlyError(e);
    if (tracker) store.tx?.update(tracker, { tone: "bad", note: msg });
    actionError.value = msg;
  } finally {
    busy.value = false;
  }
}

const doFund = () => act(`Funding ${props.id}`, "fund_workflow", [props.id], { valueAtto: genToAtto(fundAmt.value || "0") }, `${fundAmt.value} GEN locked in escrow.`);
const doFile = () => act(`Filing on ${props.id}`, "submit_evidence", [props.id, ev.value.step.trim(), ev.value.agent.trim(), ev.value.url.trim(), ev.value.summary.trim()], {}, "Evidence filed with chain timestamp.");
const doJudge = () => act(`Judging ${props.id}`, "adjudicate_workflow", [props.id], {}, "Verdict sealed by validator consensus.");
const doDispute = () => act(`Disputing ${props.id}`, "open_dispute", [props.id, note.value.trim()], {}, "Dispute opened. Reputation effects reversed.");
const doResolve = () => act(`Re-judging ${props.id}`, "resolve_dispute", [props.id], {}, "Dispute resolved with a fresh verdict.");
const doSettle = () => act(`Settling ${props.id}`, "settle_workflow", [props.id], {}, "Escrow released.");
const doRecover = () => act(`Recovering ${props.id}`, "recover_escrow", [props.id], {}, "Escrow reclaimed by owner.");

onMounted(load);
</script>
