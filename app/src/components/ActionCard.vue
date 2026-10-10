<template>
  <section class="rounded-md border border-parchment/10 bg-ink2 p-5">
    <h3 class="font-display text-lg font-semibold">{{ title }}</h3>
    <p class="mt-1 text-xs text-parchdim">{{ hint }}</p>
    <div class="mt-3">
      <slot />
    </div>
  </section>
</template>

<script setup>
defineProps({ title: { type: String, required: true }, hint: { type: String, default: "" } });
</script>
