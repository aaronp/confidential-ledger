import {
  ed25519,
  ristretto255,
  ristretto255_hasher,
  x25519,
} from "@noble/curves/ed25519.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import type {
  LedgerState,
  LedgerEntry,
  KeyPair,
  SerializedKeyPair,
  MintAllocation,
} from "./ledger.schema";

// ---------- Helpers ----------
const text = (s: string) => new TextEncoder().encode(s);
const hex = {
  fromBytes: (b: Uint8Array) => {
    let result = "";
    for (let i = 0; i < b.length; i++) {
      result += b[i].toString(16).padStart(2, "0");
    }
    return result;
  },
  toBytes: (h: string) => {
    const bytes = new Uint8Array(h.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  },
};
const b64 = {
  enc: (b: Uint8Array) => {
    let binary = "";
    for (let i = 0; i < b.length; i++) {
      binary += String.fromCharCode(b[i]);
    }
    return btoa(binary);
  },
  dec: (s: string) => {
    const binary = atob(s);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  },
};

/**
 * Generate random bytes. Exposed for test stubbing.
 * In tests, this can be replaced with deterministic randomness.
 */
export const randomBytes = (len = 32) =>
  crypto.getRandomValues(new Uint8Array(len));

const modL = (n: bigint) => {
  const L = BigInt(
    "7237005577332262213973186563042994240857116359379907606001950938285454250989"
  );
  let x = n % L;
  if (x < 0n) x += L;
  return x;
};

// ---------- Pedersen commitments ----------
const G = ristretto255.Point.BASE;
const H = ristretto255_hasher.hashToCurve(text("conf-ledger:H:v1"));

function commit(v: bigint, r: bigint) {
  // Handle zero separately - multiply by 1 and add zero point
  const vPoint = v === 0n ? ristretto255.Point.ZERO : G.multiply(v);
  const rPoint = r === 0n ? ristretto255.Point.ZERO : H.multiply(r);
  return vPoint.add(rPoint);
}

function pointToHex(P: any) {
  return hex.fromBytes(P.toBytes());
}

function pointFromHex(h: string) {
  return ristretto255.Point.fromBytes(hex.toBytes(h));
}

const bigToDec = (b: bigint) => b.toString(10);
const decToBig = (s: string) => BigInt(s);

// ---------- ECIES (X25519 + HKDF + AES-GCM) ----------
async function hkdfKey(ikm: Uint8Array) {
  return hkdf(sha256, ikm, text("salt"), text("info"), 32);
}

async function importAesKey(raw: Uint8Array) {
  return crypto.subtle.importKey(
    "raw",
    raw as BufferSource,
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );
}

async function eciesEncrypt(pub: Uint8Array, plaintext: Uint8Array) {
  const ephemeral = x25519.keygen();
  const shared = x25519.getSharedSecret(ephemeral.secretKey, pub);
  const key = await importAesKey(await hkdfKey(shared));
  const nonce = randomBytes(12);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      key,
      plaintext as BufferSource
    )
  );
  const combined = new Uint8Array(
    ephemeral.publicKey.length + nonce.length + ciphertext.length
  );
  combined.set(ephemeral.publicKey, 0);
  combined.set(nonce, ephemeral.publicKey.length);
  combined.set(ciphertext, ephemeral.publicKey.length + nonce.length);
  return b64.enc(combined);
}

async function eciesDecrypt(sk: Uint8Array, payloadB64: string) {
  const bytes = b64.dec(payloadB64);
  const epk = bytes.slice(0, 32);
  const nonce = bytes.slice(32, 44);
  const ciphertext = bytes.slice(44);
  const shared = x25519.getSharedSecret(sk, epk);
  const key = await importAesKey(await hkdfKey(shared));
  const plaintext = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ciphertext)
  );
  return plaintext;
}

// ---------- Key Generation ----------

export function generateKeyPair(id: string): KeyPair {
  const edKeys = ed25519.keygen();
  const xKeys = x25519.keygen();
  return {
    id,
    ed25519: { publicKey: edKeys.publicKey, secretKey: edKeys.secretKey },
    x25519: { publicKey: xKeys.publicKey, secretKey: xKeys.secretKey },
  };
}

export function serializeKeyPair(kp: KeyPair): SerializedKeyPair {
  return {
    id: kp.id,
    ed25519: {
      publicKey: b64.enc(kp.ed25519.publicKey),
      secretKey: b64.enc(kp.ed25519.secretKey),
    },
    x25519: {
      publicKey: b64.enc(kp.x25519.publicKey),
      secretKey: b64.enc(kp.x25519.secretKey),
    },
  };
}

export function deserializeKeyPair(skp: SerializedKeyPair): KeyPair {
  return {
    id: skp.id,
    ed25519: {
      publicKey: b64.dec(skp.ed25519.publicKey),
      secretKey: b64.dec(skp.ed25519.secretKey),
    },
    x25519: {
      publicKey: b64.dec(skp.x25519.publicKey),
      secretKey: b64.dec(skp.x25519.secretKey),
    },
  };
}

// ---------- Ledger Operations ----------

/**
 * Mint a new ledger with initial allocations.
 * This is the PoC/demo version that allows self-update mode.
 * Production versions will enforce governance rules.
 */
export async function mintPoC(
  allocs: MintAllocation[],
  allowSelfUpdate = false
): Promise<LedgerState> {
  const entries: LedgerEntry[] = [];
  let T = 0n,
    Rsum = 0n,
    Csum = ristretto255.Point.ZERO;

  for (const { holder, amount } of allocs) {
    const v = BigInt(amount);
    const r = modL(BigInt("0x" + hex.fromBytes(randomBytes(32))));
    const C = commit(v, r);
    const enc = await eciesEncrypt(
      holder.x25519.publicKey,
      text(JSON.stringify({ v: v.toString(), r: r.toString() }))
    );
    entries.push({
      holderId: holder.id,
      commit: pointToHex(C),
      openingEncrypted: enc,
    });
    T = T + v;
    Rsum = modL(Rsum + r);
    Csum = Csum.add(C);
  }

  return {
    version: "1",
    entries,
    total: { T: bigToDec(T), R: bigToDec(Rsum), commitSum: pointToHex(Csum) },
    allowSelfUpdate,
  };
}

/**
 * Verify that a ledger's total is correct.
 * Checks:
 * 1. commitSum == sum of all individual commitments
 * 2. commitSum == G×T + H×R
 */
export function verifyTotal(ledger: LedgerState): boolean {
  try {
    const T = decToBig(ledger.total.T);
    const R = decToBig(ledger.total.R);
    const claimed = pointFromHex(ledger.total.commitSum);
    const recomputed = ledger.entries
      .map((e) => pointFromHex(e.commit))
      .reduce((a, b) => a.add(b), ristretto255.Point.ZERO);
    if (!claimed.equals(recomputed)) return false;
    const openSum = G.multiply(T).add(H.multiply(R));
    return claimed.equals(openSum);
  } catch {
    return false;
  }
}

/**
 * Verify that a decrypted opening matches its commitment.
 */
export function verifyOpening(
  commitHex: string,
  v: bigint,
  r: bigint
): boolean {
  try {
    const claimed = pointFromHex(commitHex);
    const recomputed = commit(v, r);
    return claimed.equals(recomputed);
  } catch {
    return false;
  }
}

/**
 * Get a user's view of the ledger.
 * Shows their decrypted balance and the public total if verification passes.
 */
export async function getUserView(ledger: LedgerState, me: KeyPair) {
  const mine = ledger.entries.find((e) => e.holderId === me.id);
  let myBalance: bigint | null = null;
  let myEntryValid = true;

  if (mine) {
    try {
      const pt = await eciesDecrypt(me.x25519.secretKey, mine.openingEncrypted);
      const { v, r } = JSON.parse(new TextDecoder().decode(pt));
      const vBig = BigInt(v);
      const rBig = BigInt(r);
      myBalance = vBig;
      // Verify the decrypted opening matches the commitment
      myEntryValid = verifyOpening(mine.commit, vBig, rBig);
    } catch {
      myBalance = null;
      myEntryValid = false;
    }
  }
  const totalOk = verifyTotal(ledger);
  return {
    myBalance,
    myEntryValid,
    publicTotal: totalOk ? BigInt(ledger.total.T) : null,
    others: ledger.entries
      .filter((e) => e.holderId !== me.id)
      .map((e) => ({
        holderId: e.holderId,
        commit: e.commit.slice(0, 20) + "…",
        encrypted: e.openingEncrypted.slice(0, 20) + "…",
      })),
  };
}

/**
 * Update a user's own entry with a new balance.
 * Only allowed if allowSelfUpdate is true (demo mode).
 * Production will use governance rules via KeritsAdapter.
 */
export async function updateOwnEntry(
  ledger: LedgerState,
  me: KeyPair,
  newAmount: number
): Promise<LedgerState> {
  if (!ledger.allowSelfUpdate) {
    throw new Error("Self-update is not allowed on this ledger");
  }

  const myIndex = ledger.entries.findIndex((e) => e.holderId === me.id);
  if (myIndex === -1) {
    throw new Error("You don't have an entry in this ledger");
  }

  const myEntry = ledger.entries[myIndex];

  // Decrypt the old opening to get the old r value
  let oldV: bigint, oldR: bigint;
  try {
    const pt = await eciesDecrypt(me.x25519.secretKey, myEntry.openingEncrypted);
    const { v, r } = JSON.parse(new TextDecoder().decode(pt));
    oldV = BigInt(v);
    oldR = BigInt(r);
  } catch {
    throw new Error("Failed to decrypt your existing entry");
  }

  // Generate new commitment with new value
  const newV = BigInt(newAmount);
  const newR = modL(BigInt("0x" + hex.fromBytes(randomBytes(32))));
  const newC = commit(newV, newR);
  const newEnc = await eciesEncrypt(
    me.x25519.publicKey,
    text(JSON.stringify({ v: newV.toString(), r: newR.toString() }))
  );

  // Update totals
  const oldT = decToBig(ledger.total.T);
  const oldRsum = decToBig(ledger.total.R);
  const newT = oldT - oldV + newV;
  const newRsum = modL(oldRsum - oldR + newR);

  // Update entry
  const newEntries = [...ledger.entries];
  newEntries[myIndex] = {
    holderId: me.id,
    commit: pointToHex(newC),
    openingEncrypted: newEnc,
  };

  // Recompute commitment sum
  const newCsum = newEntries
    .map((e) => pointFromHex(e.commit))
    .reduce((a, b) => a.add(b), ristretto255.Point.ZERO);

  return {
    ...ledger,
    entries: newEntries,
    total: {
      T: bigToDec(newT),
      R: bigToDec(newRsum),
      commitSum: pointToHex(newCsum),
    },
  };
}
