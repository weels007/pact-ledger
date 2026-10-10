<template>
  <TopNav :address="store.address" />
  <main class="min-h-[calc(100vh-120px)]">
    <RouterView />
  </main>
  <footer class="border-t border-parchment/10">
    <div class="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-sage sm:flex-row sm:items-center">
      <p class="font-display italic">PactLedger — every pact sealed, every seal earned.</p>
      <p class="sm:ml-auto font-mono">contract {{ shortHash(CONTRACT_ADDRESS, 8) }} · {{ NETWORK_NAME }}</p>
    </div>
  </footer>
  <TxTrack ref="txRef" />
</template>

<script setup>
import { onMounted, ref, watch } from "vue";
import TopNav from "./components/TopNav.vue";
import TxTrack from "./components/TxTrack.vue";
import { store } from "./main.js";
import { CONTRACT_ADDRESS, NETWORK_NAME } from "./config.js";
import { shortHash } from "./lib/format.js";
import { getAddress, hasWallet } from "./lib/wallet.js";

const txRef = ref(null);

onMounted(() => {
  store.tx = txRef.value;
  if (hasWallet()) store.address = getAddress() || "";
});

watch(txRef, (v) => {
  if (v) store.tx = v;
});
</script>
