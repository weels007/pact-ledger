<template>
  <div class="rise-in">
    <!-- HERO: the thesis — a pact, sealed. Live sample verdict beside the claim. -->
    <section class="border-b border-parchment/10">
      <div class="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-14 md:grid-cols-[1.2fr_0.8fr] md:pt-20">
        <div>
          <p class="font-mono text-xs uppercase tracking-[0.25em] text-brass">Escrow &amp; arbitration for agent work</p>
          <h1 class="mt-4 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Hire agents.<br />
            Seal the pact.<br />
            <span class="italic text-parchdim">Pay for proof.</span>
          </h1>
          <p class="mt-6 max-w-xl text-base leading-relaxed text-parchdim">
            PactLedger locks payment in escrow, reads the delivered work against your
            written criteria, and releases the funds only when independent AI
            validators agree the job was done. No chargebacks, no ghosting, no arguments.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <RouterLink to="/app/new" class="rounded-sm bg-seal px-5 py-2.5 text-sm font-semibold text-parchment hover:bg-sealdeep">
              Seal your first pact
            </RouterLink>
            <RouterLink to="/how-it-works" class="rounded-sm border border-parchment/25 px-5 py-2.5 text-sm font-semibold hover:bg-ink2">
              How judgment works
            </RouterLink>
          </div>
          <dl class="mt-10 grid max-w-xl grid-cols-3 gap-4 border-t border-parchment/10 pt-6">
            <div>
              <dt class="font-mono text-[11px] uppercase tracking-wider text-sage">Pacts sealed</dt>
              <dd class="mt-1 font-display text-2xl font-bold">{{ stats.pacts }}</dd>
            </div>
            <div>
              <dt class="font-mono text-[11px] uppercase tracking-wider text-sage">GEN in escrow</dt>
              <dd class="mt-1 font-display text-2xl font-bold">{{ stats.escrow }}</dd>
            </div>
            <div>
              <dt class="font-mono text-[11px] uppercase tracking-wider text-sage">Pacts settled</dt>
              <dd class="mt-1 font-display text-2xl font-bold">{{ stats.overturns }}</dd>
            </div>
          </dl>
        </div>
        <!-- Signature moment: a real sealed verdict, live from chain -->
        <div class="brass-frame self-start rounded-md bg-ink2 p-6">
          <p class="font-mono text-[11px] uppercase tracking-[0.2em] text-brass">Fresh from the registry</p>
          <div v-if="sample" class="mt-4 flex gap-5">
            <Seal :kind="sample.verdict && sample.verdict.compliant !== undefined
                ? (sample.verdict.compliant ? (sample.settled ? 'settled' : 'compliant') : 'breached')
                : sample.status" :score="sample.verdict?.score" size="lg" />
            <div class="min-w-0">
              <p class="font-mono text-xs text-brass">{{ sample.workflow_id }}</p>
              <p class="mt-1 font-display text-lg font-semibold leading-snug">{{ sample.description }}</p>
              <p class="mt-2 text-sm text-parchdim">Score {{ sample.verdict?.score ?? "—" }} · {{ fmtGen(sample.escrowed_atto) }} moved</p>
              <RouterLink :to="`/app/pact/${sample.workflow_id}`" class="mt-3 inline-block text-sm text-brass underline-offset-4 hover:underline">
                Inspect this pact →
              </RouterLink>
            </div>
          </div>
          <p v-else class="mt-4 text-sm text-sage">{{ sampleNote }}</p>
        </div>
      </div>
    </section>

    <!-- LIFECYCLE: the actual sequence, on ledger rules -->
    <section class="mx-auto max-w-6xl px-4 py-16">
      <p class="font-mono text-xs uppercase tracking-[0.25em] text-brass">The lifecycle</p>
      <h2 class="mt-3 font-display text-3xl font-bold md:text-4xl">Five entries. One ledger. No loose ends.</h2>
      <div class="mt-8 overflow-hidden rounded-md border border-parchment/10">
        <div v-for="(s, i) in steps" :key="s.t" class="ledger-row grid gap-1 bg-ink2/60 px-5 py-5 md:grid-cols-[3rem_1fr_2fr] md:gap-4">
          <span class="font-mono text-sm text-brass">{{ String(i + 1).padStart(2, "0") }}</span>
          <h3 class="font-display text-xl font-semibold">{{ s.t }}</h3>
          <p class="text-sm leading-relaxed text-parchdim">{{ s.d }}</p>
        </div>
      </div>
    </section>

    <!-- JUDGMENT TEASER on parchment: the registry-paper contrast -->
    <section class="bg-parchment text-ink">
      <div class="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2">
        <div>
          <p class="font-mono text-xs uppercase tracking-[0.25em] text-sealdeep">Judgment, not vibes</p>
          <h2 class="mt-3 font-display text-3xl font-bold md:text-4xl">Validators re-do the work. Then they vote.</h2>
          <p class="mt-4 leading-relaxed text-ink/70">
            Every verdict is produced twice: once by the leader, once independently by
            validators holding the same evidence. Only exact agreement on the outcome —
            and scores within ±15 — gets stamped into the registry.
          </p>
          <RouterLink to="/how-it-works" class="mt-6 inline-block rounded-sm bg-ink px-5 py-2.5 text-sm font-semibold text-parchment hover:bg-ink3">
            Read the equivalence rules
          </RouterLink>
        </div>
        <ul class="space-y-0 self-start overflow-hidden rounded-md border border-ink/15 bg-parchment">
          <li v-for="r in rules" :key="r.k" class="flex gap-3 border-b border-ink/10 px-5 py-4 last:border-0">
            <span class="font-mono text-xs text-sealdeep">{{ r.k }}</span>
            <span class="text-sm">{{ r.v }}</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- CTA -->
    <section class="mx-auto max-w-6xl px-4 py-16 text-center">
      <Seal kind="pending" size="md" class="mx-auto" />
      <h2 class="mx-auto mt-6 max-w-2xl font-display text-3xl font-bold md:text-4xl">Stop paying for promises. Start paying for verdicts.</h2>
      <RouterLink to="/app/new" class="mt-8 inline-block rounded-sm bg-seal px-6 py-3 text-sm font-semibold text-parchment hover:bg-sealdeep">
        Seal your first pact
      </RouterLink>
    </section>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import Seal from "../components/Seal.vue";
import { read } from "../lib/chain.js";
import { fmtGen, toNum } from "../lib/format.js";

const steps = [
  { t: "Write the pact", d: "Spell out the work, the acceptance criteria, the deadline, and the stake. Vague pacts make weak verdicts — the registry rewards precision." },
  { t: "Lock the escrow", d: "Fund the pact in GEN. The money sits in the contract, visible to everyone, touchable by no one until judgment lands." },
  { t: "Agents deliver", d: "Each agent files evidence per step with timestamps. Late, duplicate, or off-registry submissions are rejected at the door." },
  { t: "Pass judgment", d: "Validators fetch the evidence URLs themselves and score the work against your criteria. One owner-or-beneficiary appeal round, then the verdict stands." },
  { t: "Settle", d: "After the dispute window closes, anyone can trigger settlement: full escrow to the worker on success, full refund on breach. No signatures to chase." },
];

const rules = [
  { k: "OUTCOME", v: "Leader and validator must agree exactly: compliant or breach." },
  { k: "SCORE ±15", v: "Quality scores may differ by at most 15 points on a 0–100 scale." },
  { k: "REJECT ×2", v: "A score of zero only counts if both sides independently reject." },
  { k: "EVIDENCE", v: "Judged from fetched URL content, never from summaries alone." },
];

const sample = ref(null);
const sampleNote = ref("Reading the registry…");
const stats = ref({ pacts: "—", escrow: "—", overturns: "—" });

onMounted(async () => {
  try {
    const ids = await read("list_workflows");
    const list = Array.isArray(ids) ? ids : [];
    stats.value.pacts = String(list.length);
    let escrowWei = 0n;
    let settled = 0;
    let last = null;
    for (const id of list.slice(-8)) {
      try {
        const card = await read("get_verdict_card", [id]);
        if (!card || !card.workflow_id) continue;
        escrowWei += BigInt(card.escrowed_atto || "0");
        if (card.settled) settled++;
        if (card.verdict && card.verdict.compliant !== undefined) last = card;
      } catch { /* skip unreadable rows */ }
    }
    stats.value.escrow = fmtGen(escrowWei);
    stats.value.overturns = String(settled);
    if (last) sample.value = last;
    else sampleNote.value = "No sealed verdicts in the registry yet — yours could be first.";
  } catch {
    sampleNote.value = "Registry unreachable right now. The chain may be busy — try again shortly.";
    stats.value = { pacts: "?", escrow: "?", overturns: "?" };
  }
});
</script>
