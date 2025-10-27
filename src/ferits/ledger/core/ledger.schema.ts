import { Type, type Static } from "@sinclair/typebox";

/**
 * Ledger Entry Schema
 * Represents a single participant's encrypted balance in the ledger.
 *
 * Visibility: Public structure, but `openingEncrypted` is holder-only readable.
 */
export const LedgerEntry = Type.Object(
  {
    holderId: Type.String({
      description: "Unique identifier for the holder (AID or alias in demo mode)",
      examples: ["alice", "bob", "did:keri:EaBc123..."],
    }),
    commit: Type.String({
      description:
        "Pedersen commitment (hex-encoded group element). " +
        "Computed as C = G×v + H×r where v is value, r is blinding factor. " +
        "This is PUBLIC but reveals nothing about the actual balance.",
      examples: [
        "a4f3c2d1e5b6a7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2",
        "d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4",
      ],
    }),
    openingEncrypted: Type.String({
      description:
        "Base64-encoded encrypted opening {v, r} using X25519 + HKDF + AES-GCM. " +
        "Only the holder with matching X25519 secret key can decrypt this. " +
        "Contains the actual balance value and blinding factor.",
      examples: [
        "BgQAZGF0YTEyMzQ1Njc4OTA=...",
        "JwssVGhpcyBpcyBhIHNhbXBsZSBlbmNyeXB0ZWQgb3BlbmluZw==...",
      ],
    }),
  },
  {
    $id: "ferits/ledger/LedgerEntry",
    description:
      "A single ledger entry with holder ID, public commitment, and encrypted opening",
  }
);

export type LedgerEntry = Static<typeof LedgerEntry>;

/**
 * Ledger Total Schema
 * Represents the aggregate state of all balances in the ledger.
 *
 * Visibility: Fully PUBLIC and verifiable by anyone.
 */
export const LedgerTotal = Type.Object(
  {
    T: Type.String({
      description:
        "Total balance across all participants, as a base-10 stringified bigint. " +
        "This is the sum of all individual balance values (Σv_i).",
      examples: ["600", "3000000", "0"],
    }),
    R: Type.String({
      description:
        "Sum of all blinding factors, as a base-10 stringified bigint (Σr_i). " +
        "Used to prove that the aggregate commitment equals G×T + H×R without revealing individual balances.",
      examples: [
        "8457392845729348572934",
        "12345678901234567890",
        "0",
      ],
    }),
    commitSum: Type.String({
      description:
        "Sum of all individual commitments, as hex-encoded group element (ΣC_i). " +
        "Anyone can verify: commitSum == G×T + H×R and commitSum == Σ(individual commits). " +
        "If verification fails, the ledger has been tampered with.",
      examples: [
        "fabc34deadbeef123456789abcdef0fedcba9876543210abcdefabcdefabcdef",
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      ],
    }),
  },
  {
    $id: "ferits/ledger/LedgerTotal",
    description:
      "Aggregate ledger state that anyone can verify without seeing individual balances",
  }
);

export type LedgerTotal = Static<typeof LedgerTotal>;

/**
 * Ledger State Schema
 * Complete internal ledger state.
 *
 * Visibility: Public structure, but individual openings are encrypted per holder.
 */
export const LedgerState = Type.Object(
  {
    version: Type.String({
      description:
        "Ledger schema version for compatibility and future migrations",
      examples: ["1"],
      pattern: "^[0-9]+$",
    }),
    entries: Type.Array(LedgerEntry, {
      description: "Array of all participant entries in the ledger",
      minItems: 0,
    }),
    total: LedgerTotal,
    allowSelfUpdate: Type.Optional(
      Type.Boolean({
        description:
          "DEMO MODE ONLY: If true, users can update their own balances without governance. " +
          "MUST be false in production deployments with proper authorization rules.",
        examples: [false, true],
      })
    ),
  },
  {
    $id: "ferits/ledger/LedgerState",
    description: "Complete internal state of a confidential ledger",
  }
);

export type LedgerState = Static<typeof LedgerState>;

/**
 * User View Schema
 * What a specific user can see when querying the ledger.
 *
 * Visibility: Per-user private view. Only returned to the authenticated holder.
 */
export const UserView = Type.Object(
  {
    myBalance: Type.Union([Type.BigInt(), Type.Null()], {
      description:
        "The user's decrypted balance value, or null if not in ledger or decryption failed. " +
        "This is PRIVATE to the holder.",
      examples: ["100n", "250n", "null"],
    }),
    myEntryValid: Type.Boolean({
      description:
        "Whether the decrypted opening matches the public commitment. " +
        "If false, the entry may have been tampered with.",
      examples: [true, false],
    }),
    publicTotal: Type.Union([Type.BigInt(), Type.Null()], {
      description:
        "The verified total balance across all participants. " +
        "Returns null if verification fails (ledger tampering detected).",
      examples: ["600n", "3000000n", "null"],
    }),
    others: Type.Array(
      Type.Object({
        holderId: Type.String({
          description: "ID of another participant",
        }),
        commit: Type.String({
          description: "Truncated commitment preview (first 20 chars + ellipsis)",
        }),
        encrypted: Type.String({
          description:
            "Truncated encrypted opening preview (first 20 chars + ellipsis)",
        }),
      }),
      {
        description:
          "List of other participants' entries (without decrypted values)",
      }
    ),
  },
  {
    $id: "ferits/ledger/UserView",
    description:
      "Per-user private view of the ledger showing their balance and public total",
  }
);

export type UserView = Static<typeof UserView>;

/**
 * Public Summary Schema
 * What any observer can see without authentication.
 *
 * Visibility: Fully PUBLIC and verifiable by anyone.
 */
export const LedgerPublicSummary = Type.Object(
  {
    version: Type.String({
      description: "Ledger schema version",
      examples: ["1"],
    }),
    participantCount: Type.Number({
      description: "Number of participants in the ledger",
      examples: [3, 5, 100],
      minimum: 0,
    }),
    total: LedgerTotal,
    verified: Type.Boolean({
      description:
        "Whether the ledger passes cryptographic verification (commitSum == ΣC_i == G×T + H×R)",
      examples: [true, false],
    }),
  },
  {
    $id: "ferits/ledger/LedgerPublicSummary",
    description:
      "Public summary of ledger state that anyone can verify without seeing individual balances",
  }
);

export type LedgerPublicSummary = Static<typeof LedgerPublicSummary>;

/**
 * Key Pair Schema
 * Represents a user's cryptographic identity.
 *
 * Visibility: PRIVATE. Never share secret keys.
 */
export const KeyPair = Type.Object(
  {
    id: Type.String({
      description: "Identifier for this keypair (AID or alias)",
      examples: ["alice", "bob", "did:keri:EaBc123..."],
    }),
    ed25519: Type.Object({
      publicKey: Type.Any({
        description: "Ed25519 public key (Uint8Array)",
      }),
      secretKey: Type.Any({
        description: "Ed25519 secret key (Uint8Array). PRIVATE - never share.",
      }),
    }),
    x25519: Type.Object({
      publicKey: Type.Any({
        description:
          "X25519 public key (Uint8Array) for encryption. This is PUBLIC.",
      }),
      secretKey: Type.Any({
        description:
          "X25519 secret key (Uint8Array) for decryption. PRIVATE - never share.",
      }),
    }),
  },
  {
    $id: "ferits/ledger/KeyPair",
    description: "Cryptographic keypair for identity, signing, and encryption",
  }
);

export type KeyPair = Static<typeof KeyPair>;

/**
 * Serialized Key Pair Schema
 * KeyPair with Base64-encoded keys for storage.
 *
 * Visibility: PRIVATE. Contains secret keys.
 */
export const SerializedKeyPair = Type.Object(
  {
    id: Type.String({
      description: "Identifier for this keypair",
    }),
    ed25519: Type.Object({
      publicKey: Type.String({
        description: "Ed25519 public key (Base64)",
      }),
      secretKey: Type.String({
        description: "Ed25519 secret key (Base64). PRIVATE - never share.",
      }),
    }),
    x25519: Type.Object({
      publicKey: Type.String({
        description: "X25519 public key (Base64)",
      }),
      secretKey: Type.String({
        description: "X25519 secret key (Base64). PRIVATE - never share.",
      }),
    }),
  },
  {
    $id: "ferits/ledger/SerializedKeyPair",
    description: "Serialized keypair with Base64-encoded keys for storage",
  }
);

export type SerializedKeyPair = Static<typeof SerializedKeyPair>;

/**
 * Mint Allocation Schema
 * Specifies how much to allocate to each holder during ledger creation.
 *
 * Visibility: Internal use during minting.
 */
export const MintAllocation = Type.Object(
  {
    holder: KeyPair,
    amount: Type.Number({
      description: "Initial balance amount to allocate",
      examples: [100, 250, 1000000],
      minimum: 0,
    }),
  },
  {
    $id: "ferits/ledger/MintAllocation",
    description: "Allocation specification for minting a new ledger",
  }
);

export type MintAllocation = Static<typeof MintAllocation>;
