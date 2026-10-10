// Wallet session: decrypt a geth-compatible keystore in-browser (ethers),
// keep the private key in sessionStorage (tab-scoped, cleared on close).
import { Wallet } from "ethers";
import { createAccount } from "genlayer-js";

const KEY = "pactledger.pk";

export function hasWallet() {
  return !!sessionStorage.getItem(KEY);
}

export function getPrivateKey() {
  return sessionStorage.getItem(KEY);
}

export function getAddress() {
  const pk = getPrivateKey();
  if (!pk) return null;
  try {
    return new Wallet(pk).address;
  } catch {
    return null;
  }
}

export async function unlockWithKeystore(jsonText, password) {
  const wallet = await Wallet.fromEncryptedJson(jsonText, password);
  sessionStorage.setItem(KEY, wallet.privateKey);
  return wallet.address;
}

export function unlockWithPrivateKey(pk) {
  const clean = pk.trim().startsWith("0x") ? pk.trim() : `0x${pk.trim()}`;
  const wallet = new Wallet(clean); // throws on invalid key
  sessionStorage.setItem(KEY, wallet.privateKey);
  return wallet.address;
}

export function lockWallet() {
  sessionStorage.removeItem(KEY);
}

export function genlayerAccount() {
  const pk = getPrivateKey();
  if (!pk) return null;
  return createAccount(pk);
}
