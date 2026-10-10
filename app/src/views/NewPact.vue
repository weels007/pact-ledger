<template>
  <div class="rise-in mx-auto max-w-2xl px-4 py-10">
    <p class="font-mono text-xs uppercase tracking-[0.25em] text-brass">New pact</p>
    <h1 class="mt-2 font-display text-4xl font-bold">Write it precisely.</h1>
    <p class="mt-2 text-sm text-parchdim">Vague pacts make weak verdicts. Validators grade only against what you write here.</p>

    <form class="mt-8 space-y-5 rounded-md border border-parchment/10 bg-ink2 p-6" @submit.prevent="submit">
      <div>
        <label class="text-xs text-parchdim" for="wid">Pact ID — short, unique, no spaces</label>
        <input id="wid" v-model="f.id" required pattern="[A-Za-z0-9_-]+" class="mt-1.5 w-full rounded-sm border border-parchment/20 bg-ink px-3 py-2 font-mono text-sm" placeholder="website-relaunch-01" />
      </div>
      <div>
        <label class="text-xs text-parchdim" for="desc">Work description</label>
        <textarea id="desc" v-model="f.description" required rows="2" class="mt-1.5 w-full rounded-sm border border-parchment/20 bg-ink px-3 py-2 text-sm" placeholder="What exactly must be delivered?"></textarea>
      </div>
      <div>
        <label class="text-xs text-parchdim" for="crit">Acceptance criteria — the grading rubric</label>
        <textarea id="crit" v-model="f.criteria" required rows="3" class="mt-1.5 w-full rounded-sm border border-parchment/20 bg-ink px-3 py-2 text-sm" placeholder="Must include…, must do…, must not…"></textarea>
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="text-xs text-parchdim" for="dl">Submission deadline</label>
          <input id="dl" v-model="f.deadline" type="datetime-local" required class="mt-1.5 w-full rounded-sm border border-parchment/20 bg-ink px-3 py-2 text-sm" />
        </div>
        <div>
          <label class="text-xs text-parchdim" for="win">Dispute window</label>
          <select id="win" v-model="f.window" class="mt-1.5 w-full rounded-sm border border-parchment/20 bg-ink px-3 py-2 text-sm">
            <option value="300">5 minutes (demo)</option>
            <option value="3600">1 hour</option>
            <option value="86400">24 hours (recommended)</option>
            <option value="604800">7 days</option>
          </select>
        </div>
      </div>
      <div>
        <label class="text-xs text-parchdim" for="parts">Agents — comma separated names</label>
        <input id="parts" v-model="f.participants" required class="mt-1.5 w-full rounded-sm border border-parchment/20 bg-ink px-3 py-2 font-mono text-sm" placeholder="agent-alpha,agent-beta" />
      </div>
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="text-xs text-parchdim" for="pen">Stake / penalty (GEN)</label>
          <input id="pen" v-model="f.penalty" required inputmode="decimal" pattern="[0-9]+(\.[0-9]+)?" class="mt-1.5 w-full rounded-sm border border-parchment/20 bg-ink px-3 py-2 font-mono text-sm" placeholder="1" />
        </div>
        <div>
          <label class="text-xs text-parchdim" for="ben">Beneficiary wallet (0x…)</label>
          <input id="ben" v-model="f.beneficiary" required pattern="0x[0-9a-fA-F]{40}" class="mt-1.5 w-full rounded-sm border border-parchment/20 bg-ink px-3 py-2 font-mono text-sm" placeholder="0x…" />
        </div>
      </div>

      <p v-if="error" class="rounded-sm border border-seal/50 bg-sealdeep/20 px-3 py-2 text-sm text-seal" role="alert">{{ error }}</p>

      <button :disabled="busy" class="w-full rounded-sm bg-seal px-4 py-3 text-sm font-semibold text-parchment disabled:opacity-50">
        {{ busy ? "Sealing on-chain…" : "Seal the pact" }}
      </button>
      <p class="text-center text-xs text-sage">Registration is a consensus transaction — it takes a few seconds to seal.</p>
    </form>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { store } from "../main.js";
import { write, executionOutcome } from "../lib/chain.js";
import { friendlyError } from "../lib/chain.js";
import { datetimeLocalToUnix, genToAtto } from "../lib/format.js";
import { getAddress } from "../lib/wallet.js";

const router = useRouter();
const f = ref({
  id: "", description: "", criteria: "", deadline: "",
  window: "86400", participants: "", penalty: "1",
  beneficiary: getAddress() || "",
});
const busy = ref(false);
const error = ref("");

async function submit() {
  if (!getAddress()) {
    router.push("/app/connect");
    return;
  }
  busy.value = true;
  error.value = "";
  const id = f.value.id.trim();
  const tracker = store.tx?.push({ title: `Sealing pact ${id}`, hash: "…" });
  try {
    const { hash, receipt } = await write(
      "register_workflow",
      [
        id,
        f.value.description.trim(),
        f.value.criteria.trim(),
        datetimeLocalToUnix(f.value.deadline),
        f.value.participants.trim(),
        genToAtto(f.value.penalty).toString(),
        f.value.beneficiary.trim(),
        Number(f.value.window),
      ],
      { onHash: (h) => store.tx?.update(tracker, { hash: h }) }
    );
    const out = executionOutcome(receipt);
    if (!out.ok) {
      store.tx?.update(tracker, { tone: "bad", note: out.expectedMessage || "Chain rejected the pact." });
      error.value = out.expectedMessage
        ? `Rejected: ${out.expectedMessage}`
        : "The transaction finalized without effect (validators could not agree). Nothing was stored.";
      return;
    }
    store.tx?.update(tracker, { tone: "good", hash, note: "Pact sealed in the registry." });
    router.push(`/app/pact/${id}`);
  } catch (e) {
    const msg = friendlyError(e);
    if (tracker) store.tx?.update(tracker, { tone: "bad", note: msg });
    error.value = msg;
  } finally {
    busy.value = false;
  }
}
</script>
