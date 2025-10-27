/**
 * Test fixtures and helpers for stablecoin tests.
 *
 * Provides:
 * - Pre-generated test identities
 * - Helper functions for creating test assets
 * - Deterministic setup for reproducible tests
 */

import { generateKeyPair, type KeyPair } from "../../ledger/core/ledger.api";
import type { AssetRules, MintAllocation } from "../core/stablecoin.api";

/**
 * Create standard test identities.
 * These are generated fresh each time to ensure test isolation.
 */
export function createTestIdentities(): {
  alice: KeyPair;
  bob: KeyPair;
  carol: KeyPair;
  dave: KeyPair;
  treasurer: KeyPair;
} {
  return {
    alice: generateKeyPair("alice"),
    bob: generateKeyPair("bob"),
    carol: generateKeyPair("carol"),
    dave: generateKeyPair("dave"),
    treasurer: generateKeyPair("treasurer"),
  };
}

/**
 * Create a holder key map from identities.
 */
export function createHolderKeyMap(
  identities: Record<string, KeyPair>
): Map<string, KeyPair> {
  const map = new Map<string, KeyPair>();
  for (const [_name, keypair] of Object.entries(identities)) {
    map.set(keypair.id, keypair);
  }
  return map;
}

/**
 * Standard demo mode rules for testing.
 */
export const DEMO_RULES: AssetRules = {
  allowSelfMint: true,
  allowSelfBurn: true,
  transferable: true,
  cappedSupply: false,
};

/**
 * Production-like rules (no self-operations).
 */
export const PRODUCTION_RULES: AssetRules = {
  allowSelfMint: false,
  allowSelfBurn: false,
  transferable: true,
  cappedSupply: false,
};

/**
 * Capped supply rules.
 */
export function cappedSupplyRules(maxSupply: number): AssetRules {
  return {
    allowSelfMint: false,
    allowSelfBurn: false,
    transferable: true,
    cappedSupply: true,
    maxSupply: maxSupply.toString(),
  };
}

/**
 * Create simple test allocations.
 */
export function createSimpleAllocations(
  identities: { alice: KeyPair; bob: KeyPair; carol: KeyPair }
): MintAllocation[] {
  return [
    { recipient: identities.alice.id, amount: 100 },
    { recipient: identities.bob.id, amount: 200 },
    { recipient: identities.carol.id, amount: 300 },
  ];
}
