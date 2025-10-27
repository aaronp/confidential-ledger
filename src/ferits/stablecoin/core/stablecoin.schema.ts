import { Type, type Static } from "@sinclair/typebox";

/**
 * Asset Rules Schema
 * Defines governance and constraint rules for a fungible asset.
 *
 * Visibility: Internal configuration (visible to asset managers).
 */
export const AssetRules = Type.Object(
  {
    allowSelfMint: Type.Optional(
      Type.Boolean({
        description:
          "DEMO MODE ONLY: If true, users can mint tokens to themselves without authority checks. " +
          "MUST be false in production.",
        examples: [false, true],
      })
    ),
    allowSelfBurn: Type.Optional(
      Type.Boolean({
        description:
          "DEMO MODE ONLY: If true, users can burn their own tokens without authority checks. " +
          "MUST be false in production.",
        examples: [false, true],
      })
    ),
    transferable: Type.Optional(
      Type.Boolean({
        description:
          "Whether tokens can be transferred between holders. Default: true. " +
          "Set to false for non-transferable tokens (e.g., reputation scores).",
        examples: [true, false],
      })
    ),
    cappedSupply: Type.Optional(
      Type.Boolean({
        description:
          "Whether there's a maximum supply cap. If true, maxSupply MUST be set.",
        examples: [false, true],
      })
    ),
    maxSupply: Type.Optional(
      Type.String({
        description:
          "Maximum total supply (base-10 stringified bigint). " +
          "Only enforced if cappedSupply is true.",
        examples: ["1000000", "500", "100"],
      })
    ),
  },
  {
    $id: "ferits/stablecoin/AssetRules",
    description: "Governance and constraint rules for a fungible asset",
  }
);

export type AssetRules = Static<typeof AssetRules>;

/**
 * Operation Schema
 * Represents a single mint, burn, or transfer operation on an asset.
 *
 * Visibility: Public structure, but amounts may be encrypted in transit.
 */
export const Operation = Type.Object(
  {
    id: Type.String({
      description: "Unique operation identifier (UUID or hash)",
      examples: ["op_8f7d6e5c4b3a2", "mint_alice_100_20250127"],
    }),
    type: Type.Union(
      [
        Type.Literal("mint"),
        Type.Literal("burn"),
        Type.Literal("transfer"),
      ],
      {
        description:
          "Operation type: mint (create), burn (destroy), or transfer (move)",
      }
    ),
    timestamp: Type.Number({
      description: "Unix timestamp (milliseconds) when operation was created",
      examples: [1735689600000, 1738368000000],
    }),
    authority: Type.Optional(
      Type.String({
        description:
          "AID of the authority who authorized this operation (for mint/burn)",
        examples: ["did:keri:treasurer_alice", "did:keri:coordinator_bob"],
      })
    ),
    from: Type.Optional(
      Type.String({
        description: "AID of sender (for transfers and burns)",
        examples: ["did:keri:alice", "did:keri:bob"],
      })
    ),
    to: Type.Optional(
      Type.String({
        description: "AID of recipient (for transfers and mints)",
        examples: ["did:keri:carol", "did:keri:dave"],
      })
    ),
    amount: Type.String({
      description: "Amount of tokens affected, as base-10 stringified bigint",
      examples: ["100", "500", "1000000"],
    }),
    reason: Type.Optional(
      Type.String({
        description: "Human-readable justification or memo for this operation",
        examples: [
          "Initial allocation",
          "Deposit verified",
          "Payment for services",
        ],
      })
    ),
    status: Type.Union(
      [
        Type.Literal("pending"),
        Type.Literal("confirmed"),
        Type.Literal("settled"),
      ],
      {
        description:
          "Settlement status: pending (awaiting confirmation), confirmed (acknowledged), settled (anchored to KEL)",
      }
    ),
    signature: Type.Optional(
      Type.Any({
        description:
          "Cryptographic signature by authority (Uint8Array in runtime). " +
          "Proves operation was authorized by the claimed AID.",
      })
    ),
  },
  {
    $id: "ferits/stablecoin/Operation",
    description:
      "Represents a single mint, burn, or transfer operation on an asset",
  }
);

export type Operation = Static<typeof Operation>;

/**
 * Asset State Schema
 * Complete internal state of a fungible asset.
 *
 * Visibility: Internal state (managers can see all; users see filtered views).
 */
export const AssetState = Type.Object(
  {
    version: Type.String({
      description: "Asset state schema version for compatibility/migrations",
      examples: ["1"],
      pattern: "^[0-9]+$",
    }),
    assetId: Type.String({
      description:
        "Unique identifier for this asset type (e.g., 'eyamcoin', 'volunteerhours')",
      examples: ["eyamcoin", "volunteerhours", "eventtickets"],
    }),
    assetName: Type.String({
      description:
        "Human-readable name for this asset (displayed in UI)",
      examples: ["EyamCoin", "Volunteer Hours", "Event Tickets"],
    }),
    ledger: Type.Any({
      description:
        "Confidential ledger state from Phase F1 (ferits/ledger/core/ledger.schema.ts). " +
        "MUST conform to LedgerState schema. " +
        "This field is not re-implemented; stablecoin layer consumes ledger APIs.",
      // Note: Type.Any is used here because LedgerState is from another module
      // In implementation, we'll import and validate the actual type
    }),
    operations: Type.Array(Operation, {
      description:
        "Append-only event log of all operations. Used for audit trail and replay.",
      examples: [[]],
    }),
    authorities: Type.Object({
      mintAuthority: Type.Array(Type.String(), {
        description:
          "List of AIDs authorized to mint tokens. Empty array = no one can mint.",
        examples: [["did:keri:treasurer_alice"], []],
      }),
      burnAuthority: Type.Array(Type.String(), {
        description:
          "List of AIDs authorized to burn tokens. Empty array = no one can burn.",
        examples: [["did:keri:treasurer_alice"], []],
      }),
    }),
    rules: AssetRules,
  },
  {
    $id: "ferits/stablecoin/AssetState",
    description: "Complete internal state of a fungible asset",
  }
);

export type AssetState = Static<typeof AssetState>;

/**
 * Wallet View Schema
 * What a specific user sees when viewing their wallet.
 *
 * Visibility: Per-user private view. Only returned to the authenticated holder.
 */
export const WalletView = Type.Object(
  {
    assetId: Type.String({
      description: "Asset identifier",
    }),
    assetName: Type.String({
      description: "Asset display name",
    }),
    myBalance: Type.Union([Type.BigInt(), Type.Null()], {
      description:
        "User's decrypted balance, or null if not a holder or decryption failed. " +
        "This is PRIVATE to the holder.",
      examples: ["100n", "250n", "null"],
    }),
    myBalanceValid: Type.Boolean({
      description:
        "Whether the decrypted balance matches the public commitment. " +
        "If false, the entry may have been tampered with.",
      examples: [true, false],
    }),
    publicTotalSupply: Type.Union([Type.BigInt(), Type.Null()], {
      description:
        "The verified total supply across all holders. " +
        "Returns null if verification fails (ledger tampering detected).",
      examples: ["1000n", "50000n", "null"],
    }),
    myOperations: Type.Array(Operation, {
      description: "Operations involving this user (as sender or recipient)",
    }),
    canMint: Type.Boolean({
      description: "Whether this user has mint authority",
    }),
    canBurn: Type.Boolean({
      description: "Whether this user has burn authority",
    }),
  },
  {
    $id: "ferits/stablecoin/WalletView",
    description: "Per-user wallet view showing balance and permissions",
  }
);

export type WalletView = Static<typeof WalletView>;

/**
 * Public Summary Schema
 * What any observer can see without authentication.
 *
 * Visibility: Fully PUBLIC and verifiable by anyone.
 */
export const AssetPublicSummary = Type.Object(
  {
    version: Type.String({
      description: "Asset state schema version",
      examples: ["1"],
    }),
    assetId: Type.String({
      description: "Asset identifier",
    }),
    assetName: Type.String({
      description: "Asset display name",
    }),
    holderCount: Type.Number({
      description: "Number of holders (participants with non-zero balances)",
      examples: [3, 5, 100],
      minimum: 0,
    }),
    totalSupply: Type.String({
      description:
        "Total supply across all holders (base-10 stringified bigint)",
      examples: ["1000", "500000"],
    }),
    operationCount: Type.Number({
      description: "Total number of operations (mint/burn/transfer)",
      examples: [10, 50, 1000],
      minimum: 0,
    }),
    verified: Type.Boolean({
      description:
        "Whether the asset passes cryptographic verification " +
        "(ledger commitments match totals)",
      examples: [true, false],
    }),
    transferable: Type.Boolean({
      description: "Whether tokens are transferable",
    }),
    cappedSupply: Type.Boolean({
      description: "Whether supply is capped",
    }),
    maxSupply: Type.Optional(
      Type.String({
        description: "Maximum supply if capped",
      })
    ),
  },
  {
    $id: "ferits/stablecoin/AssetPublicSummary",
    description: "Public summary of asset state verifiable by anyone",
  }
);

export type AssetPublicSummary = Static<typeof AssetPublicSummary>;

/**
 * Mint Allocation Schema
 * Specifies how much to allocate to each holder during asset creation.
 *
 * Visibility: Internal use during asset creation.
 */
export const MintAllocation = Type.Object(
  {
    recipient: Type.String({
      description: "AID or alias of the recipient",
      examples: ["alice", "bob", "did:keri:carol"],
    }),
    amount: Type.Number({
      description: "Amount to allocate",
      examples: [100, 250, 1000000],
      minimum: 0,
    }),
  },
  {
    $id: "ferits/stablecoin/MintAllocation",
    description: "Allocation specification for asset creation or minting",
  }
);

export type MintAllocation = Static<typeof MintAllocation>;

/**
 * Transfer Request Schema
 * User-initiated transfer request.
 *
 * Visibility: Private between sender and recipient.
 */
export const TransferRequest = Type.Object(
  {
    from: Type.String({
      description: "AID of sender (must be current user)",
    }),
    to: Type.String({
      description: "AID of recipient",
    }),
    amount: Type.Number({
      description: "Amount to transfer",
      minimum: 1,
    }),
    memo: Type.Optional(
      Type.String({
        description: "Optional transfer memo",
      })
    ),
  },
  {
    $id: "ferits/stablecoin/TransferRequest",
    description: "User-initiated transfer request",
  }
);

export type TransferRequest = Static<typeof TransferRequest>;
