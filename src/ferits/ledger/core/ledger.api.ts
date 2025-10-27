/**
 * Public API surface for the confidential ledger capability.
 *
 * This module provides the primary interface for working with
 * private-balance, public-total ledgers using Pedersen commitments.
 *
 * UI and test code should import from this module, not from internals.
 */

// Re-export types from schema
export type {
  LedgerState,
  LedgerEntry,
  LedgerTotal,
  UserView,
  LedgerPublicSummary,
  KeyPair,
  SerializedKeyPair,
  MintAllocation,
} from "./ledger.schema";

// Re-export schema validators for runtime validation
export {
  LedgerState,
  LedgerEntry,
  LedgerTotal,
  UserView,
  LedgerPublicSummary,
  KeyPair,
  SerializedKeyPair,
  MintAllocation,
} from "./ledger.schema";

// Re-export core functions
export {
  generateKeyPair,
  serializeKeyPair,
  deserializeKeyPair,
  mintPoC,
  verifyTotal,
  verifyOpening,
  getUserView,
  updateOwnEntry,
} from "./ledger.impl";

// Re-export verification helpers
export { getPublicSummary } from "./ledger.verify";
