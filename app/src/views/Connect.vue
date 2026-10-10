<template>
  <div class="rise-in mx-auto max-w-xl px-4 py-14">
    <p class="font-mono text-xs uppercase tracking-[0.25em] text-brass">Wallet</p>
    <h1 class="mt-3 font-display text-4xl font-bold">{{ address ? "Connected" : "Connect a wallet" }}</h1>

    <div v-if="address" class="brass-frame mt-8 rounded-md bg-ink2 p-6">
      <p class="font-mono text-[11px] uppercase tracking-wider text-sage">Active account</p>
      <p class="mt-2 break-all font-mono text-sm text-pine">{{ address }}</p>
      <p class="mt-2 text-xs text-parchdim">Key lives in this tab only (session storage) and is forgotten when the tab closes.</p>
      <button class="mt-5 rounded-sm border border-seal/60 px-4 py-2 text-sm font-semibold text-seal hover:bg-seal hover:text-parchment" @click="lock">
        Lock wallet
      </button>
    </div>

    <div v-else class="mt-8 rounded-md border border-parchment/10 bg-ink2 p-6">
      <div class="flex gap-2 text-sm">
        <button :class="tabCls('file')" @click="tab = 'file'">Keystore file</button>
        <button :class="tabCls('key')" @click="tab = 'key'">Private key</button>
      </div>

      <div v-if="tab === 'file'" class="mt-5">
        <label class="block text-xs text-parchdim" for="ks">Geth-compatible keystore JSON (e.g. pactledger-keystore.json)</label>
        <input id="ks" type="file" accept=".json,application/json" class="mt-2 block w-full text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-ink3 file:px-3 file:py-2 file:text-parchment" @change="onFile" />
        <label class="mt-4 block text-xs text-parchdim" for="kspw">Keystore password</label>
        <input id="kspw" v-model="password" type="password" autocomplete="off" class="mt-2 w-full rounded-sm border border-parchment/20 bg-ink px-3 py-2 text-sm" placeholder="••••••••" />
        <button :disabled="!fileText || !password || busy" class="mt-5 w-full rounded-sm bg-brass px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-40" @click="unlockFile">
          {{ busy ? "Decrypting…" : "Unlock keystore" }}
        </button>
      </div>

      <div v-else class="mt-5">
        <label class="block text-xs text-parchdim" for="pk">Private key (0x…)</label>
        <input id="pk" v-model="privkey" type="password" autocomplete="off" class="mt-2 w-full rounded-sm border border-parchment/20 bg-ink px-3 py-2 font-mono text-sm" placeholder="0x…" />
        <button :disabled="!privkey || busy" class="mt-5 w-full rounded-sm bg-brass px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-40" @click="unlockKey">
          {{ busy ? "Checking…" : "Use this key" }}
        </button>
        <p class="mt-3 text-xs text-sage">Pasted keys never leave this tab. Prefer the keystore file.</p>
      </div>

      <p v-if="error" class="mt-4 rounded-sm border border-seal/50 bg-sealdeep/20 px-3 py-2 text-sm text-seal" role="alert">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { store } from "../main.js";
import { getAddress, lockWallet, unlockWithKeystore, unlockWithPrivateKey } from "../lib/wallet.js";

const router = useRouter();
const address = ref(getAddress());
const tab = ref("file");
const fileText = ref("");
const password = ref("");
const privkey = ref("");
const busy = ref(false);
const error = ref("");

function tabCls(t) {
  return `rounded-sm px-3 py-1.5 ${tab.value === t ? "bg-ink3 text-parchment" : "text-parchdim hover:text-parchment"}`;
}

function onFile(e) {
  error.value = "";
  const f = e.target.files?.[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => { fileText.value = String(r.result || ""); };
  r.onerror = () => { error.value = "Could not read that file."; };
  r.readAsText(f);
}

async function unlockFile() {
  busy.value = true;
  error.value = "";
  try {
    await unlockWithKeystore(fileText.value, password.value);
    password.value = "";
    fileText.value = "";
    address.value = getAddress();
    store.address = address.value || "";
    router.push("/app");
  } catch {
    error.value = "Wrong password or invalid keystore file. Check both and retry.";
  } finally {
    busy.value = false;
  }
}

function unlockKey() {
  busy.value = true;
  error.value = "";
  try {
    unlockWithPrivateKey(privkey.value);
    privkey.value = "";
    address.value = getAddress();
    store.address = address.value || "";
    router.push("/app");
  } catch {
    error.value = "That doesn't look like a valid private key.";
  } finally {
    busy.value = false;
  }
}

function lock() {
  lockWallet();
  store.address = "";
  address.value = "";
}
</script>
