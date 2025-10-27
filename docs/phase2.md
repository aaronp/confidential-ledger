# Phase F2 — Community Token (Stablecoin / Fungible Assets)

> **Goal:** Build a general-purpose fungible asset system with mint, burn, and transfer operations — supporting community currencies, local reserve-backed tokens, and other token-based use cases.

---

## Overview

Phase F2 implements a **stablecoin / fungible asset** capability that layers on top of the confidential ledger from Phase F1.

The module is intentionally generic:
- The directory is `stablecoin/` (not `eyamcoin/`)
- EyamCoin is a **deployment/use-case** of this module (local reserve-backed token)
- Other use-cases: volunteer credits, community hours, tickets, etc.

Key features:
- **Mint:** Create new tokens (with authority checks)
- **Burn:** Destroy tokens (with authority checks)
- **Transfer:** Move tokens between holders
- **Finality:** Reconciliation and settlement tracking
- **Wallet UI:** Simple interface for group-based token management

This module builds on F1's privacy guarantees:
- Individual balances remain private (encrypted openings)
- Total supply is publicly verifiable (Pedersen commitments)
- All operations are deterministic and auditable

---

## Conformance to `guidance.md`

**Dependencies:**
- **Depends on:** Phase F1 (ledger) complete and imported as library module
- **Feeds into:** Phase F3 (budgeting), F4 (fundraising), F5 (governance)

Phase F2 MUST:

- Provide a **core module** under `src/ferits/stablecoin/core/`:
  - deterministic state transitions for mint/burn/transfer
  - cryptographic verification helpers
  - no UI / no network assumptions
- Provide **TypeBox schemas** in `stablecoin.schema.ts` with field-level descriptions, examples, and visibility notes.
- Provide **deterministic tests** in `src/ferits/stablecoin/test/` using golden snapshots and reproducible randomness.
  - Tests MUST reuse deterministic `randomBytes` and fixed timestamps (as in F1) for snapshot stability
- Provide a **UI route** at `/stablecoin` that:
  - shows the user's token balance
  - allows transfers to other participants
  - displays the public total supply
  - demonstrates mint/burn operations (if user has authority)
- Update the **Dashboard** (`/dashboard`) with a card linking to `/stablecoin` describing "Community tokens with private balances and public supply."
- Document governance assumptions: who can mint/burn in production, how authority is granted via Kerits credentials, and how operations can be anchored and synced.

See [guidance](./guidance.md) for directory layout, adapter interfaces, deterministic testing, and dashboard conventions.

---

## Features

### 1. Mint Operation

**Purpose:** Create new tokens and allocate them to a holder.

**Inputs:**
- `authority`: AID with mint permission (verified via KeritsAdapter)
- `recipient`: AID receiving the tokens
- `amount`: Number of tokens to mint
- `reason`: Optional human-readable justification

**Outputs:**
- Updated ledger state with new entry or increased balance
- Event log entry for auditability

**Rules:**
- Only AIDs with `mint_authority` credential can mint
- Amount must be non-negative
- In demo mode (`allowSelfMint: true`), any user can mint for themselves

### 2. Burn Operation

**Purpose:** Destroy tokens, reducing total supply.

**Inputs:**
- `authority`: AID with burn permission
- `holder`: AID whose tokens are being burned
- `amount`: Number of tokens to burn
- `reason`: Optional justification

**Outputs:**
- Updated ledger state with reduced balance
- Event log entry

**Rules:**
- Only AIDs with `burn_authority` credential can burn
- Holder must have sufficient balance
- In demo mode (`allowSelfBurn: true`), users can burn their own tokens

### 3. Transfer Operation

**Purpose:** Move tokens from one holder to another.

**Inputs:**
- `from`: AID sending tokens
- `to`: AID receiving tokens
- `amount`: Number of tokens to transfer
- `memo`: Optional transfer description

**Outputs:**
- Updated ledger state with adjusted balances
- Event log entry

**Rules:**
- `from` must have sufficient balance
- Transfer must be signed by `from` (via KeritsAdapter)
- Amount must be positive

**Privacy:**
- Only `from` and `to` can see the transfer amount
- Others see only updated commitments (not the actual values)
- Total supply remains verifiable

### 4. Finality & Reconciliation

**Purpose:** Track settlement status and ensure operations are acknowledged.

**Operation Lifecycle:**

| Status | Meaning | Transition Trigger |
|--------|---------|-------------------|
| `pending` | Operation created, awaiting recipient or chain confirmation | After submit |
| `confirmed` | Recipient or quorum acknowledged | On acknowledgment |
| `settled` | Anchored to Kerits TEL & immutable | After TEL anchoring |

**Features:**
- Settlement requires acknowledgment from recipient (for transfers)
- Finality tracking for integration with external systems (e.g., bank reserves for EyamCoin)
- Immutable operations prevent double-spend and ensure audit trail

---

## Technical Architecture

### State Model

```ts
interface AssetState {
  version: string; // e.g. "1"
  assetId: string; // unique identifier for this token type
  assetName: string; // e.g. "EyamCoin", "Volunteer Hours"
  ledger: LedgerState; // from F1 - ferits/ledger/core/ledger.schema.ts
  operations: Array<Operation>; // event log (append-only)
  authorities: {
    mintAuthority: AID[]; // who can mint
    burnAuthority: AID[]; // who can burn
  };
  rules: AssetRules; // governance and constraint rules
}

interface AssetRules {
  allowSelfMint?: boolean; // demo mode: users can mint to themselves
  allowSelfBurn?: boolean; // demo mode: users can burn their own tokens
  transferable?: boolean; // whether tokens can be transferred (default: true)
  cappedSupply?: boolean; // whether there's a maximum supply
  maxSupply?: string; // max total supply (base-10 stringified bigint, if capped)
}

interface Operation {
  id: string; // unique operation ID
  type: "mint" | "burn" | "transfer";
  timestamp: number;
  authority?: AID; // who authorized this operation
  from?: AID; // for transfers and burns
  to?: AID; // for transfers and mints
  amount: string; // base-10 stringified bigint
  reason?: string;
  status: "pending" | "confirmed" | "settled";
  signature?: Uint8Array; // signed by authority
}
```

**Important notes:**
- The `ledger` field MUST conform to `LedgerState` as defined in `ferits/ledger/core/ledger.schema.ts`
- It is not re-implemented here; the stablecoin layer consumes and mutates that state via public ledger APIs
- All TypeBox schemas will use `$id: "ferits/stablecoin/AssetState"` (not "StablecoinState") for neutrality

**TypeBox Schema Example:**

```ts
import { Type, type Static } from "@sinclair/typebox";

export const Operation = Type.Object(
  {
    id: Type.String({
      description: "Unique operation identifier (UUID or hash)",
      examples: ["op_8f7d6e5c4b3a2", "mint_alice_100_20250127"],
    }),
    type: Type.Union([
      Type.Literal("mint"),
      Type.Literal("burn"),
      Type.Literal("transfer"),
    ], {
      description: "Operation type: mint (create), burn (destroy), or transfer (move)",
    }),
    timestamp: Type.Number({
      description: "Unix timestamp (milliseconds) when operation was created",
      examples: [1735689600000, 1738368000000],
    }),
    authority: Type.Optional(Type.String({
      description: "AID of the authority who authorized this operation (for mint/burn)",
      examples: ["did:keri:treasurer_alice", "did:keri:coordinator_bob"],
    })),
    from: Type.Optional(Type.String({
      description: "AID of sender (for transfers and burns)",
      examples: ["did:keri:alice", "did:keri:bob"],
    })),
    to: Type.Optional(Type.String({
      description: "AID of recipient (for transfers and mints)",
      examples: ["did:keri:carol", "did:keri:dave"],
    })),
    amount: Type.String({
      description: "Amount of tokens affected, as base-10 stringified bigint",
      examples: ["100", "500", "1000000"],
    }),
    reason: Type.Optional(Type.String({
      description: "Human-readable justification or memo for this operation",
      examples: ["Initial allocation", "Deposit verified", "Payment for services"],
    })),
    status: Type.Union([
      Type.Literal("pending"),
      Type.Literal("confirmed"),
      Type.Literal("settled"),
    ], {
      description: "Settlement status of the operation",
    }),
    signature: Type.Optional(Type.Any({
      description: "Cryptographic signature by authority (Uint8Array in runtime)",
    })),
  },
  {
    $id: "ferits/stablecoin/Operation",
    description: "Represents a single mint, burn, or transfer operation on an asset",
  }
);

export type Operation = Static<typeof Operation>;
```

### Event Types

```ts
type AssetEvent =
  | { type: "asset.created"; asset: AssetState }
  | { type: "tokens.minted"; operation: Operation; newLedger: LedgerState }
  | { type: "tokens.burned"; operation: Operation; newLedger: LedgerState }
  | { type: "tokens.transferred"; operation: Operation; newLedger: LedgerState }
  | { type: "operation.confirmed"; operationId: string }
  | { type: "operation.settled"; operationId: string };
```

### State Transitions

All state transitions MUST be:
- **Deterministic:** Same events → same state
- **Verifiable:** Signed by authorized AIDs
- **Auditable:** Full operation log retained
- **Testable:** Golden snapshots for every transition

**State Transition Functions:**

All functions are async to support encryption, signing, and adapter calls:

```ts
async function createAsset(
  assetId: string,
  assetName: string,
  authorities: { mintAuthority: AID[]; burnAuthority: AID[] },
  rules: AssetRules,
  initialAllocations: MintAllocation[]
): Promise<AssetState>;

async function mint(
  state: AssetState,
  authority: AID,
  recipient: AID,
  amount: number,
  reason?: string
): Promise<AssetState>;

async function burn(
  state: AssetState,
  authority: AID,
  holder: AID,
  amount: number,
  reason?: string
): Promise<AssetState>;

async function transfer(
  state: AssetState,
  from: AID,
  to: AID,
  amount: number,
  memo?: string
): Promise<AssetState>;
```

---

## Use Cases

### EyamCoin (Local Reserve-Backed Token)

**Scenario:** A community creates a local currency backed by GBP reserves.

**Mint Authority:** Treasurer with verified `treasurer_role` credential
**Burn Authority:** Treasurer
**Reserve Ratio:** 1:1 (1 EyamCoin = £1 in bank account)

**Flow:**
1. Community member deposits £100 into community bank account
2. Treasurer verifies deposit and mints 100 EyamCoin to member's AID
3. Member transfers EyamCoin to others in the community
4. Member redeems 50 EyamCoin for £50 cash
5. Treasurer burns 50 EyamCoin and pays out £50

**Privacy:**
- Members see their own balance
- Treasurer can see total supply (must match bank balance)
- Individual transaction amounts remain private

### Volunteer Hours

**Scenario:** Track volunteer contributions with hourly credits.

**Mint Authority:** Project coordinators
**Burn Authority:** No burn (hours are permanent record)

**Flow:**
1. Volunteer completes 5 hours of work
2. Coordinator mints 5 VolunteerHours to volunteer's AID
3. Volunteer can see accumulated hours
4. Community can verify total hours contributed

### Event Tickets

**Scenario:** Limited-capacity event with transferable tickets.

**Mint Authority:** Event organizer
**Burn Authority:** Event organizer (for redemption)
**Supply Cap:** Fixed at event capacity

**Flow:**
1. Organizer mints 100 EventTicket tokens (one per capacity)
2. Tickets are distributed/sold to attendees
3. Attendees can transfer tickets to friends
4. At event entrance, tickets are burned (redeemed)
5. Public total shows tickets remaining

---

## UI Requirements (`/stablecoin`)

The UI MUST demonstrate:

1. **Wallet View:**
   - Current balance (decrypted from ledger)
   - Recent operations (transfers in/out)
   - Public total supply

2. **Transfer Form:**
   - Recipient AID input
   - Amount input
   - Optional memo
   - Balance validation (can't transfer more than you have)

3. **Mint/Burn Controls** (if user has authority):
   - Mint: recipient + amount + reason
   - Burn: holder + amount + reason
   - Authority badge display

4. **Operation History:**
   - Filterable event log
   - Show operation status (pending/confirmed/settled)
   - Highlight user's own operations

5. **Privacy Demonstration:**
   - Show that user can only see their own balance
   - Show that others' balances are encrypted
   - Show that total supply is publicly verifiable

---

## Testing Strategy

### Golden Snapshot Tests

Every state transition MUST have golden test coverage:

- Asset creation with initial allocations
- Minting tokens to new holder
- Minting tokens to existing holder
- Burning tokens (full balance)
- Burning tokens (partial balance)
- Transfer between holders
- Transfer with insufficient balance (should fail)
- Unauthorized mint attempt (should fail)
- Unauthorized burn attempt (should fail)
- Ledger verification after each operation

### Property-Based Tests

- Total supply always equals sum of individual balances
- Mint increases total by mint amount
- Burn decreases total by burn amount
- Transfer preserves total (from - amount + to + amount = same total)
- Balances never go negative
- Operation log is append-only and immutable

### Integration Tests with F1

- Verify ledger state after operations
- Verify commitments match openings
- Verify privacy guarantees (can't see others' balances)
- Verify public total correctness

---

## Governance & Authority

### Demo Mode

For local development and demos:
- `allowSelfMint: true` lets users mint to themselves
- `allowSelfBurn: true` lets users burn their own tokens
- No credential checks required

### Production Mode

For real deployments:
- Mint authority MUST be checked via `KeritsAdapter.hasCredential(aid, "mint_authority")`
- Burn authority MUST be checked via `KeritsAdapter.hasCredential(aid, "burn_authority")`
- Operations MUST be signed by the authority AID
- Credentials can be issued by governance processes (Phase F5)

**Credential Requirements:**

Credentials MUST be verifiable through `KeritsAdapter` and express both scope (`assetId`) and limits (e.g., `maxMintPerDay`, expiry, etc.). This anchors future multi-asset support where one treasurer might have authority over multiple token types with different constraints.

**Credential Examples:**
```ts
{
  type: "mint_authority",
  issuer: "did:keri:governance_group",
  subject: "did:keri:treasurer_alice",
  claims: {
    assetId: "eyamcoin",
    maxMintPerDay: 1000,
    expiresAt: 1735689600000
  }
}
```

### Anchoring to Kerits

Each operation SHOULD generate a signed event:
```ts
const operation = { type: "mint", ... };
const payload = canonicalize(operation); // deterministic JSON encoding
const signature = await KeritsAdapter.sign(payload);
// Append to KEL for permanent audit trail
```

### Sync via Merits

Asset state updates can be broadcast to a group:
```ts
const newState = await mint(state, authority, recipient, amount);
const commitSumHash = sha256(newState.ledger.total.commitSum);

await MeritsAdapter.broadcast(
  "eyamcoin_group",
  {
    type: "asset.updated",
    operation: newOperation,
    commitSumHash: hex.fromBytes(commitSumHash)
  }
);
```

**Efficient Verification:**

Each broadcast message SHOULD include both the operation and the new `commitSum` hash, so peers can efficiently verify consistency before downloading full ledger state.

Group members receive update and verify:
- Signature is valid (via KeritsAdapter)
- Authority has mint credential
- CommitSum hash matches expected value
- Ledger verification passes (if full state downloaded)
- Accept or reject update

---

## Success Criteria

Phase F2 is complete when:

1. ✅ `src/ferits/stablecoin/core/` exists with deterministic mint/burn/transfer logic
2. ✅ `stablecoin.schema.ts` defines TypeBox schemas for:
   - Full asset state (internal)
   - User wallet view (private)
   - Public summary (total supply, operation count)
3. ✅ Golden snapshot + property tests in `src/ferits/stablecoin/test/` pass with deterministic randomness
4. ✅ `/stablecoin` route renders working wallet UI using real logic (not mocks)
5. ✅ `/dashboard` card links to `/stablecoin` with description: "Community tokens with private balances and public supply"
6. ✅ Governance/authority assumptions documented (who can mint/burn, credential requirements)
7. ✅ This document references `guidance.md`

After F2 is complete:
- **F2b** can add credential-gated token variants (e.g., EyamCoinA for age-restricted)
- **F3** can use stablecoin operations for budget reimbursements
- **F4** can settle pledges using token transfers

---

## Implementation Checklist

- [ ] Define `StablecoinState` and `Operation` schemas in `stablecoin.schema.ts`
- [ ] Implement `createAsset()` function in `stablecoin.impl.ts`
- [ ] Implement `mint()` function with authority checks
- [ ] Implement `burn()` function with authority checks
- [ ] Implement `transfer()` function with balance validation
- [ ] Add operation signing and verification helpers
- [ ] Write golden snapshot tests for all operations
- [ ] Write property tests for invariants (total supply, non-negative balances)
- [ ] Create wallet UI component showing balance and transfer form
- [ ] Create mint/burn UI for authorized users
- [ ] Create operation history view
- [ ] Update dashboard with stablecoin card
- [ ] Document EyamCoin deployment example
- [ ] Document governance integration points

---

## Next Steps

After F2 completion:
- **F2b** adds credential-gated variants (age-restricted tokens)
- **F3** uses stablecoin for budget tracking and reimbursement
- **F4** uses stablecoin transfers for pledge settlement

Phase F2 provides the **economic foundation** for Ferits — turning the confidential ledger into a programmable asset system.
