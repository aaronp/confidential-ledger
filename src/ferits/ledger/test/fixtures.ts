/**
 * Test fixtures and deterministic randomness for ledger tests.
 *
 * This module provides:
 * - Deterministic random number generation for reproducible tests
 * - Pre-generated keypairs for common test identities
 * - Helper functions for creating test ledgers
 */

import { generateKeyPair, type KeyPair } from "../core/ledger.impl";

/**
 * Deterministic random bytes generator for tests.
 * Uses a simple counter-based approach to ensure reproducibility.
 */
let deterministicCounter = 0;

export function resetDeterministicRandom() {
  deterministicCounter = 0;
}

export function getDeterministicRandomBytes(len: number): Uint8Array {
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    // Use a simple deterministic pattern
    bytes[i] = (deterministicCounter + i * 17 + 42) % 256;
  }
  deterministicCounter += len;
  return bytes;
}

/**
 * Pre-generated test identities.
 * These are generated fresh each time to avoid key reuse issues,
 * but could be made deterministic if needed for golden snapshots.
 */
export function createTestIdentities(): {
  alice: KeyPair;
  bob: KeyPair;
  carol: KeyPair;
  dave: KeyPair;
} {
  return {
    alice: generateKeyPair("alice"),
    bob: generateKeyPair("bob"),
    carol: generateKeyPair("carol"),
    dave: generateKeyPair("dave"),
  };
}

/**
 * Helper to create a simple test ledger with fixed allocations.
 */
export async function createSimpleTestLedger(
  mintFn: any,
  identities: { alice: KeyPair; bob: KeyPair; carol: KeyPair }
) {
  return await mintFn([
    { holder: identities.alice, amount: 100 },
    { holder: identities.bob, amount: 200 },
    { holder: identities.carol, amount: 300 },
  ]);
}
