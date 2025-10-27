import {
  mintPoC,
  updateOwnEntry,
  type LedgerState,
  type MintAllocation as LedgerMintAllocation,
  type KeyPair,
} from "../../ledger/core/ledger.api";
import type {
  AssetState,
  AssetRules,
  Operation,
  MintAllocation,
} from "./stablecoin.schema";
import type { AID } from "../../../adapters/kerits.adapter";

// Helper to generate operation IDs
function generateOperationId(type: string, timestamp: number): string {
  return `${type}_${timestamp}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Create a new fungible asset with initial allocations.
 *
 * @param assetId - Unique asset identifier
 * @param assetName - Human-readable asset name
 * @param authorities - Mint and burn authorities
 * @param rules - Asset governance rules
 * @param initialAllocations - Initial token allocations
 * @param holderKeys - KeyPair map for initial holders (AID -> KeyPair)
 * @returns New AssetState
 */
export async function createAsset(
  assetId: string,
  assetName: string,
  authorities: { mintAuthority: AID[]; burnAuthority: AID[] },
  rules: AssetRules,
  initialAllocations: MintAllocation[],
  holderKeys: Map<string, KeyPair>
): Promise<AssetState> {
  // Check supply cap before creating ledger
  if (rules.cappedSupply && rules.maxSupply) {
    const totalInitialSupply = initialAllocations.reduce(
      (sum, alloc) => sum + BigInt(alloc.amount),
      0n
    );
    const maxSupply = BigInt(rules.maxSupply);

    if (totalInitialSupply > maxSupply) {
      throw new Error(
        `Initial allocations total (${totalInitialSupply}) would exceed max supply of ${maxSupply}`
      );
    }
  }

  // Convert allocations to ledger format
  const ledgerAllocations: LedgerMintAllocation[] = initialAllocations.map(
    (alloc) => {
      const holder = holderKeys.get(alloc.recipient);
      if (!holder) {
        throw new Error(
          `No KeyPair found for recipient "${alloc.recipient}". ` +
            `Create the identity first.`
        );
      }
      return {
        holder,
        amount: alloc.amount,
      };
    }
  );

  // Create underlying ledger
  const ledger = await mintPoC(
    ledgerAllocations,
    rules.allowSelfMint || rules.allowSelfBurn
  );

  // Create operation log entries for initial mints
  const operations: Operation[] = initialAllocations.map((alloc, index) => ({
    id: generateOperationId("mint", Date.now() + index),
    type: "mint" as const,
    timestamp: Date.now() + index,
    authority: authorities.mintAuthority[0], // Use first authority for initial mints
    to: alloc.recipient,
    amount: alloc.amount.toString(),
    reason: "Initial allocation",
    status: "confirmed" as const,
  }));

  return {
    version: "1",
    assetId,
    assetName,
    ledger,
    operations,
    authorities,
    rules: rules || {},
  };
}

/**
 * Mint new tokens to a recipient.
 *
 * @param state - Current asset state
 * @param authority - AID requesting mint (must have mint authority)
 * @param recipient - AID receiving tokens
 * @param amount - Amount to mint
 * @param reason - Optional justification
 * @param recipientKey - KeyPair of recipient (needed for ledger encryption)
 * @param checkAuthority - Function to check if AID has mint authority (optional, for testing)
 * @returns Updated AssetState
 */
export async function mint(
  state: AssetState,
  authority: AID,
  recipient: AID,
  amount: number,
  reason?: string,
  recipientKey?: KeyPair,
  checkAuthority?: (aid: AID) => Promise<boolean>
): Promise<AssetState> {
  // Check authority (unless in demo mode)
  if (!state.rules.allowSelfMint) {
    const hasAuth = checkAuthority
      ? await checkAuthority(authority)
      : state.authorities.mintAuthority.includes(authority);

    if (!hasAuth) {
      throw new Error(
        `AID "${authority}" does not have mint authority for asset "${state.assetId}"`
      );
    }
  }

  // Check supply cap
  if (state.rules.cappedSupply && state.rules.maxSupply) {
    const currentSupply = BigInt(state.ledger.total.T);
    const maxSupply = BigInt(state.rules.maxSupply);
    const newSupply = currentSupply + BigInt(amount);

    if (newSupply > maxSupply) {
      throw new Error(
        `Minting ${amount} would exceed max supply of ${maxSupply}. ` +
          `Current supply: ${currentSupply}`
      );
    }
  }

  // For minting, we need to update the ledger
  // This is tricky because F1's ledger doesn't have a direct "mint to existing holder" function
  // We'll need to use the updateOwnEntry if they already exist, or create a new entry

  // Find if recipient already has an entry
  const existingEntry = state.ledger.entries.find(
    (e) => e.holderId === recipient
  );

  let newLedger: LedgerState;

  if (existingEntry && recipientKey) {
    // Update existing balance using updateOwnEntry
    // This requires the recipient's KeyPair and calculates their current balance + mint amount
    // Note: This is a simplified approach; in production, we'd need more sophisticated ledger updates
    throw new Error(
      "Minting to existing holders not yet implemented. " +
        "Please mint to new holders only for now."
    );
  } else {
    // Mint to new holder - we need to re-mint the entire ledger with the new holder
    // This is a limitation of the current F1 ledger design
    // For now, we'll throw an error and require using createAsset for initial allocations
    throw new Error(
      "Dynamic minting not yet fully implemented. " +
        "Use createAsset with initialAllocations for now."
    );
  }

  // Create operation record
  const operation: Operation = {
    id: generateOperationId("mint", Date.now()),
    type: "mint",
    timestamp: Date.now(),
    authority,
    to: recipient,
    amount: amount.toString(),
    reason,
    status: "pending",
  };

  return {
    ...state,
    ledger: newLedger,
    operations: [...state.operations, operation],
  };
}

/**
 * Burn tokens from a holder.
 *
 * @param state - Current asset state
 * @param authority - AID requesting burn (must have burn authority)
 * @param holder - AID whose tokens are being burned
 * @param amount - Amount to burn
 * @param reason - Optional justification
 * @param holderKey - KeyPair of holder (needed for ledger updates)
 * @param checkAuthority - Function to check if AID has burn authority
 * @returns Updated AssetState
 */
export async function burn(
  state: AssetState,
  authority: AID,
  holder: AID,
  amount: number,
  reason?: string,
  holderKey?: KeyPair,
  checkAuthority?: (aid: AID) => Promise<boolean>
): Promise<AssetState> {
  // Check authority (unless in demo mode with self-burn)
  const isSelfBurn = authority === holder && state.rules.allowSelfBurn;

  if (!isSelfBurn) {
    const hasAuth = checkAuthority
      ? await checkAuthority(authority)
      : state.authorities.burnAuthority.includes(authority);

    if (!hasAuth) {
      throw new Error(
        `AID "${authority}" does not have burn authority for asset "${state.assetId}"`
      );
    }
  }

  // For burning, we need the holder's key to update their balance
  if (!holderKey) {
    throw new Error(`KeyPair required for holder "${holder}" to burn tokens`);
  }

  // Find holder's current balance
  const holderEntry = state.ledger.entries.find((e) => e.holderId === holder);
  if (!holderEntry) {
    throw new Error(`Holder "${holder}" has no balance to burn`);
  }

  // We need to decrypt the holder's balance to check if they have enough
  // This requires getUserView from F1, but for now we'll use a simplified approach
  // In a full implementation, we'd import getUserView and check the balance

  // For now, throw error - burning not fully implemented
  throw new Error(
    "Burning not yet fully implemented. " +
      "Ledger modification for burn operations requires additional F1 API enhancements."
  );
}

/**
 * Transfer tokens from one holder to another.
 *
 * @param state - Current asset state
 * @param from - AID of sender
 * @param to - AID of recipient
 * @param amount - Amount to transfer
 * @param memo - Optional transfer memo
 * @param fromKey - KeyPair of sender
 * @param toKey - KeyPair of recipient (if new holder)
 * @returns Updated AssetState
 */
export async function transfer(
  state: AssetState,
  from: AID,
  to: AID,
  amount: number,
  memo?: string,
  fromKey?: KeyPair,
  toKey?: KeyPair
): Promise<AssetState> {
  // Check if transfers are allowed
  if (state.rules.transferable === false) {
    throw new Error(
      `Asset "${state.assetId}" is non-transferable. Transfers are disabled.`
    );
  }

  if (amount <= 0) {
    throw new Error("Transfer amount must be positive");
  }

  if (from === to) {
    throw new Error("Cannot transfer to yourself");
  }

  // Verify sender exists in ledger
  const fromEntry = state.ledger.entries.find((e) => e.holderId === from);
  if (!fromEntry) {
    throw new Error(`Sender "${from}" has no balance in this asset`);
  }

  if (!fromKey) {
    throw new Error(`KeyPair required for sender "${from}" to transfer tokens`);
  }

  // For transfers, we need to:
  // 1. Reduce sender's balance by amount
  // 2. Increase recipient's balance by amount (or create new entry)
  // This requires sophisticated ledger manipulation that F1 doesn't currently support

  throw new Error(
    "Transfers not yet fully implemented. " +
      "Ledger modification for transfers requires additional F1 API enhancements."
  );
}

/**
 * Get the total supply from the ledger.
 * This is a convenience function that reads the public total.
 */
export function getTotalSupply(state: AssetState): bigint {
  return BigInt(state.ledger.total.T);
}

/**
 * Count the number of holders (participants with entries).
 */
export function getHolderCount(state: AssetState): number {
  return state.ledger.entries.length;
}

/**
 * Get operations involving a specific AID.
 */
export function getUserOperations(
  state: AssetState,
  aid: AID
): Operation[] {
  return state.operations.filter(
    (op) =>
      op.from === aid ||
      op.to === aid ||
      (op.authority === aid && (op.type === "mint" || op.type === "burn"))
  );
}
