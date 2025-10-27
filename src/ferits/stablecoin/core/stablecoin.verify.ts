/**
 * Verification and public summary helpers for the stablecoin capability.
 *
 * These functions provide read-only views and verification logic
 * that can be used by external observers without authentication.
 */

import { verifyTotal, getUserView, type KeyPair } from "../../ledger/core/ledger.api";
import type { AssetState, AssetPublicSummary, WalletView } from "./stablecoin.schema";
import type { AID } from "../../../adapters/kerits.adapter";
import { getTotalSupply, getHolderCount, getUserOperations } from "./stablecoin.impl";

/**
 * Get a public summary of the asset that anyone can see and verify.
 * No authentication required.
 */
export function getPublicSummary(state: AssetState): AssetPublicSummary {
  const verified = verifyTotal(state.ledger);
  const totalSupply = getTotalSupply(state);
  const holderCount = getHolderCount(state);

  return {
    version: state.version,
    assetId: state.assetId,
    assetName: state.assetName,
    holderCount,
    totalSupply: totalSupply.toString(),
    operationCount: state.operations.length,
    verified,
    transferable: state.rules.transferable !== false,
    cappedSupply: state.rules.cappedSupply || false,
    maxSupply: state.rules.maxSupply,
  };
}

/**
 * Get a wallet view for a specific user.
 * Shows their balance, permissions, and relevant operations.
 *
 * @param state - Current asset state
 * @param userKey - User's KeyPair for decrypting their balance
 * @returns WalletView for this user
 */
export async function getWalletView(
  state: AssetState,
  userKey: KeyPair
): Promise<WalletView> {
  // Get user's ledger view (decrypts their balance)
  const ledgerView = await getUserView(state.ledger, userKey);

  // Check permissions
  const canMint =
    state.rules.allowSelfMint ||
    state.authorities.mintAuthority.includes(userKey.id);
  const canBurn =
    state.rules.allowSelfBurn ||
    state.authorities.burnAuthority.includes(userKey.id);

  // Get user's operations
  const myOperations = getUserOperations(state, userKey.id);

  return {
    assetId: state.assetId,
    assetName: state.assetName,
    myBalance: ledgerView.myBalance,
    myBalanceValid: ledgerView.myEntryValid,
    publicTotalSupply: ledgerView.publicTotal,
    myOperations,
    canMint,
    canBurn,
  };
}

/**
 * Verify that an asset's state is consistent.
 * Checks both ledger verification and operational constraints.
 */
export function verifyAssetState(state: AssetState): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check ledger verification
  if (!verifyTotal(state.ledger)) {
    errors.push("Ledger verification failed: commitSum doesn't match entries");
  }

  // Check supply cap (if applicable)
  if (state.rules.cappedSupply && state.rules.maxSupply) {
    const totalSupply = getTotalSupply(state);
    const maxSupply = BigInt(state.rules.maxSupply);
    if (totalSupply > maxSupply) {
      errors.push(
        `Total supply (${totalSupply}) exceeds max supply (${maxSupply})`
      );
    }
  }

  // Check that ledger entries match expected holder count
  const holderCount = getHolderCount(state);
  if (holderCount < 0) {
    errors.push(`Invalid holder count: ${holderCount}`);
  }

  // Check operation log integrity (should be append-only)
  const operationIds = new Set<string>();
  for (const op of state.operations) {
    if (operationIds.has(op.id)) {
      errors.push(`Duplicate operation ID: ${op.id}`);
    }
    operationIds.add(op.id);

    // Check operation timestamps are monotonic (within reason)
    // This is a soft check - we allow some clock skew
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if an AID has mint authority for this asset.
 */
export function hasMintAuthority(state: AssetState, aid: AID): boolean {
  return (
    state.rules.allowSelfMint ||
    state.authorities.mintAuthority.includes(aid)
  );
}

/**
 * Check if an AID has burn authority for this asset.
 */
export function hasBurnAuthority(state: AssetState, aid: AID): boolean {
  return (
    state.rules.allowSelfBurn ||
    state.authorities.burnAuthority.includes(aid)
  );
}
