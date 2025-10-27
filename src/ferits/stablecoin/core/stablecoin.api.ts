/**
 * Public API surface for the stablecoin / fungible asset capability.
 *
 * This module provides the primary interface for working with
 * fungible assets (tokens) with mint, burn, and transfer operations.
 *
 * UI and test code should import from this module, not from internals.
 */

// Re-export types from schema
export type {
  AssetState,
  AssetRules,
  Operation,
  WalletView,
  AssetPublicSummary,
  MintAllocation,
  TransferRequest,
} from "./stablecoin.schema";

// Re-export schema validators for runtime validation
export {
  AssetState,
  AssetRules,
  Operation,
  WalletView,
  AssetPublicSummary,
  MintAllocation,
  TransferRequest,
} from "./stablecoin.schema";

// Re-export core functions
export {
  createAsset,
  mint,
  burn,
  transfer,
  getTotalSupply,
  getHolderCount,
  getUserOperations,
} from "./stablecoin.impl";

// Re-export verification helpers
export {
  getPublicSummary,
  getWalletView,
  verifyAssetState,
  hasMintAuthority,
  hasBurnAuthority,
} from "./stablecoin.verify";
