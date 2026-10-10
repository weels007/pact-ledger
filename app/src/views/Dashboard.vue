<template>
  <div class="rise-in mx-auto max-w-6xl px-4 py-10">
    <div class="flex flex-wrap items-end gap-4">
      <div>
        <p class="font-mono text-xs uppercase tracking-[0.25em] text-brass">Registry</p>
        <h1 class="mt-2 font-display text-4xl font-bold">Every pact on record</h1>
      </div>
      <RouterLink to="/app/new" class="ml-auto rounded-sm bg-seal px-4 py-2 text-sm font-semibold text-parchment hover:bg-sealdeep">
        + New pact
      </RouterLink>
    </div>

    <div v-if="loading" class="mt-8 space-y-3" aria-busy="true">
      <div v-for="i in 3" :key="i" class="h-20 animate-pulse rounded-md bg-ink2"></div>
    </div>

    <p v-else-if="error" class="mt-8 rounded-sm border border-seal/50 bg-sealdeep/20 px-4 py-3 text-sm text-seal" role="alert">
      {{ error }}
      <button class="ml-2 underline underline-offset-2" @click="load">Retry</button>
    </p>

    <div v-else-if="rows.length === 0" class="mt-8 rounded-md border border-dashed border-parchment/25 px-6 py-14 text-center">
      <Seal kind="pending" size="md" class="mx-auto opacity-80" />
      <p class="mt-4 font-display text-2xl font-semibold">The registry is empty.</p>
      <p class="mx-auto mt-2 max-w-md text-sm text-parchdim">No pacts sealed yet. Write the first one — criteria, stake, deadline — and put agents to work.</p>
      <RouterLink to="/app/new" class="mt-6 inline-block rounded-sm bg-seal px-5 py-2.5 text-sm font-semibold text-parchment hover:bg-sealdeep">Seal the first pact</RouterLink>
    </div>

    <div v-else class="mt-8 overflow-hidden rounded-md border border-parchment/10">
      <RouterLink
        v-for="r in rows"
        :key="r.workflow_id"
        :to="`/app/pact/${r.workflow_id}`"
        class="ledger-row grid items-center gap-3 bg-ink2/60 px-4 py-4 transition hover:bg-ink2 md:grid-cols-[auto_1fr_auto_auto_auto]"
      >
        <Seal :kind="sealKind(r)" :score="r.verdict?.score" size="sm" />
        <div class="min-w-0">
          <p class="truncate font-display text-lg font-semibold">{{ r.description }}</p>
          <p class="mt-0.5 font-mono text-[11px] text-sage">{{ r.workflow_id }} · {{ r.evidence_count }} filings · {{ rowNote(r) }}</p>
        </div>
        <span class="font-mono text-xs text-brass">{{ fmtGen(r.escrowed_atto) }} escrow</span>
        <span class="font-mono text-xs" :class="r.settled ? 'text-pine' : 'text-parchdim'">{{ r.settled ? 'settled' : r.status }}</span>
        <span class="hidden font-mono text-brass md:inline">→</span>
      </RouterLink>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import Seal from "../components/Seal.vue";
import { read } from "../lib/chain.js";
import { fmtCountdown, fmtGen } from "../lib/format.js";

const rows = ref([]);
const loading = ref(true);
const error = ref("");

function sealKind(r) {
  if (r.settled) return "settled";
  if (r.status === "disputed") return "disputed";
  if (r.verdict && r.verdict.compliant !== undefined) return r.verdict.compliant ? "compliant" : "breached";
  return r.status || "open";
}

function statusWord(r) {
  return { open: "taking filings", disputed: "under dispute", compliant: "passed", breached: "failed" }[r.status] || r.status;
}

function rowNote(r) {
  const settled = !!r.settled;
  const judged = r.verdict && Object.keys(r.verdict).length > 0;
  if (!judged) return statusWord(r);
  if (!settled && fmtCountdown(r.settle_after) === "ready") return `${statusWord(r)} · settleable`;
  return statusWord(r);
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const ids = await read("list_workflows");
    const list = (Array.isArray(ids) ? ids : []).slice().reverse();
    const out = [];
    for (const id of list) {
      try {
        const card = await read("get_verdict_card", [id]);
        if (card && card.workflow_id) out.push(card);
      } catch { /* skip */ }
    }
    rows.value = out;
  } catch {
    error.value = "Registry unreachable. The chain may be busy — retry in a moment.";
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
