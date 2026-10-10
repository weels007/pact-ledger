<!-- The verdict seal: PactLedger's signature element. A hand-stamped ring
     whose ink color carries the outcome. -->
<template>
  <div
    class="seal-stamp inline-flex items-center justify-center"
    :class="sizeClass"
    :style="{ color: ink }"
    role="img"
    :aria-label="`Seal: ${label}`"
  >
    <div class="seal-ring flex h-full w-full items-center justify-center p-1">
      <div class="seal-ring-inner flex h-full w-full flex-col items-center justify-center px-2 text-center leading-none">
        <span class="font-display font-bold uppercase" :class="labelClass">{{ label }}</span>
        <span v-if="sub" class="mt-1 font-mono" :class="subClass">{{ sub }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  kind: { type: String, default: "pending" }, // compliant | breached | disputed | open | settled | pending
  score: { type: [Number, String], default: null },
  size: { type: String, default: "md" }, // sm | md | lg
});

const ink = computed(() => {
  switch (props.kind) {
    case "compliant":
    case "settled":
      return "#3FA46F";
    case "breached":
      return "#AE3226";
    case "disputed":
    case "open":
      return "#C29B3C";
    default:
      return "#7D8B7A";
  }
});

const label = computed(() => {
  switch (props.kind) {
    case "compliant":
      return "Sealed";
    case "breached":
      return "Breach";
    case "disputed":
      return "Dispute";
    case "open":
      return "Open";
    case "settled":
      return "Settled";
    default:
      return "Pact";
  }
});

const sub = computed(() => {
  if (props.score === null || props.score === undefined || props.score === "") return "";
  return `${props.score}`;
});

const sizeClass = computed(() =>
  props.size === "lg" ? "h-32 w-32" : props.size === "sm" ? "h-14 w-14" : "h-20 w-20"
);
const labelClass = computed(() =>
  props.size === "lg" ? "text-xl" : props.size === "sm" ? "text-[10px]" : "text-xs"
);
const subClass = computed(() =>
  props.size === "lg" ? "text-sm" : props.size === "sm" ? "text-[9px]" : "text-[10px]"
);
</script>
