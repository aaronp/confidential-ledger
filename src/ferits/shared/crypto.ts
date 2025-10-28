/**
 * Shared cryptographic utilities for Ferits modules.
 *
 * These functions are used across ledger, fundraising, and other capabilities
 * for Pedersen commitments and ristretto255 operations.
 */

import { ristretto255, ristretto255_hasher } from "@noble/curves/ed25519.js";

const text = (s: string) => new TextEncoder().encode(s);

export const hex = {
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

/**
 * Generate random bytes for blinding factors.
 */
export const randomBytes = (len = 32) =>
  crypto.getRandomValues(new Uint8Array(len));

/**
 * Random scalar in the ristretto255 scalar field.
 */
export function randomScalar(): Uint8Array {
  return randomBytes(32);
}

/**
 * Modulo L (ristretto255 scalar field order)
 */
export const modL = (n: bigint) => {
  const L = BigInt(
    "7237005577332262213973186563042994240857116359379907606001950938285454250989"
  );
  let x = n % L;
  if (x < 0n) x += L;
  return x;
};

// Pedersen commitment generators
const G = ristretto255.Point.BASE;
const H = ristretto255_hasher.hashToCurve(text("conf-ledger:H:v1"));

/**
 * Creates a Pedersen commitment: C = G×v + H×r
 *
 * @param v - Value to commit to
 * @param r - Blinding factor (32 bytes)
 * @returns Hex-encoded commitment point
 */
export function pedersen(v: bigint, r: Uint8Array): string {
  const rBig = modL(BigInt("0x" + hex.fromBytes(r)));
  const vMod = modL(v);
  const vPoint = vMod === 0n ? ristretto255.Point.ZERO : G.multiply(vMod);
  const rPoint = rBig === 0n ? ristretto255.Point.ZERO : H.multiply(rBig);
  const C = vPoint.add(rPoint);
  return hex.fromBytes(C.toBytes());
}

/**
 * Adds two ristretto255 points (hex-encoded).
 *
 * @param aHex - First point as hex string
 * @param bHex - Second point as hex string
 * @returns Sum of points as hex string
 */
export function ristrettoAdd(aHex: string, bHex: string): string {
  const A = ristretto255.Point.fromBytes(hex.toBytes(aHex));
  const B = ristretto255.Point.fromBytes(hex.toBytes(bHex));
  return hex.fromBytes(A.add(B).toBytes());
}

/**
 * Verifies that a commitment opens to the given value and blinding factor.
 *
 * @param commitHex - Commitment as hex string
 * @param v - Value
 * @param r - Blinding factor
 * @returns True if commitment is valid
 */
export function verifyOpening(commitHex: string, v: bigint, r: Uint8Array): boolean {
  const C = ristretto255.Point.fromBytes(hex.toBytes(commitHex));
  const rBig = BigInt("0x" + hex.fromBytes(r));
  const expected = pedersen(v, r);
  return commitHex === expected;
}
