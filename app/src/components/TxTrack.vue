<!-- Global tx tracker: toasts for pending / success / failure with
     copyable hash and explorer link. -->
<template>
  <div class="pointer-events-none fixed bottom-4 right-4 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2">
    <div
      v-for="t in txs"
      :key="t.id"
      class="toast-in pointer-events-auto rounded-md border border-parchment/15 bg-ink2 p-3 shadow-xl"
    >
      <div class="flex items-start justify-between gap-2">
        <p class="font-display text-sm font-semibold">{{ t.title }}</p>
        <button class="text-parchdim hover:text-parchment" @click="dismiss(t.id)" aria-label="Dismiss">✕</button>
      </div>
      <p class="mt-0.5 font-mono text-[11px] text-parchdim">{{ shortHash(t.hash) }}</p>
      <p v-if="t.note" class="mt-1 text-xs" :class="t.tone === 'bad' ? 'text-seal' : 'text-sage'">{{ t.note }}</p>
      <div class="mt-2 flex gap-2 text-xs">
        <button class="rounded border border-parchment/20 px-2 py-1 hover:bg-ink3" @click="copy(t.hash)">Copy hash</button>
        <a class="rounded border border-parchment/20 px-2 py-1 hover:bg-ink3" :href="explorerTx(t.hash)" target="_blank" rel="noreferrer">Explorer ↗</a>
        <span v-if="t.tone === 'wait'" class="ml-auto self-center font-mono text-[11px] text-brass">sealing…</span>
        <span v-if="t.tone === 'good'" class="ml-auto self-center font-mono text-[11px] text-pine">sealed ✓</span>
        <span v-if="t.tone === 'bad'" class="ml-auto self-center font-mono text-[11px] text-seal">failed</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive } from "vue";
import { EXPLORER_BASE } from "../config.js";
import { shortHash } from "../lib/format.js";

const txs = reactive([]);
let nextId = 1;

function explorerTx(hash) {
  return `${EXPLORER_BASE}/tx/${hash}`;
}

function push({ title, hash, tone = "wait", note = "" }) {
  const id = nextId++;
  txs.unshift({ id, title, hash, tone, note });
  if (txs.length > 4) txs.pop();
  return id;
}

function update(id, patch) {
  const t = txs.find((x) => x.id === id);
  if (t) Object.assign(t, patch);
}

function dismiss(id) {
  const i = txs.findIndex((x) => x.id === id);
  if (i >= 0) txs.splice(i, 1);
}

function copy(text) {
  navigator.clipboard?.writeText(text);
}

defineExpose({ push, update, dismiss });
</script>
