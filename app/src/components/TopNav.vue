<template>
  <header class="border-b border-parchment/10 bg-ink/95 backdrop-blur">
    <div class="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
      <RouterLink to="/" class="flex items-center gap-2.5">
        <span class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-brass font-display text-sm font-bold text-brass">P</span>
        <span class="font-display text-lg font-bold tracking-tight">PactLedger</span>
      </RouterLink>
      <nav class="ml-2 hidden items-center gap-5 text-sm text-parchdim sm:flex" aria-label="Primary">
        <RouterLink to="/app" class="hover:text-parchment">Registry</RouterLink>
        <RouterLink to="/app/new" class="hover:text-parchment">New pact</RouterLink>
        <RouterLink to="/how-it-works" class="hover:text-parchment">How it works</RouterLink>
      </nav>
      <div class="ml-auto flex items-center gap-3">
        <span class="hidden font-mono text-[11px] text-sage md:inline">studionet</span>
        <RouterLink
          v-if="!address"
          to="/app/connect"
          class="rounded-sm bg-brass px-3 py-1.5 text-sm font-semibold text-ink hover:bg-parchment"
        >
          Connect wallet
        </RouterLink>
        <button
          v-else
          class="flex items-center gap-2 rounded-sm border border-pine/50 px-3 py-1.5 font-mono text-xs text-pine hover:bg-ink3"
          :title="address"
          @click="goAccount"
        >
          <span class="inline-block h-2 w-2 rounded-full bg-pine"></span>
          {{ shortHash(address, 4) }}
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { useRouter } from "vue-router";
import { shortHash } from "../lib/format.js";

defineProps({ address: { type: String, default: "" } });
const router = useRouter();
function goAccount() {
  router.push("/app/connect");
}
</script>
