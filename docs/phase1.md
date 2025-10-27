# Phase 1 — Confidential Ledger (Private Balances / Public Total)

> **Goal:** A shared ledger that keeps each participant's balance private while making the total publicly verifiable.  
> This is the financial foundation for community money, budgeting, reimbursement, fundraising, and transparent treasuries.

---

## Conformance to `guidance.md`

Phase 1 MUST:

- Provide a **core module** under `src/ferits/ledger/core/`:
  - deterministic state transitions
  - cryptographic verification helpers
  - no UI / no network assumptions
- Provide **TypeBox schemas** in `ledger.schema.ts` with field-level descriptions, examples, and visibility notes (public vs private).
- Provide **deterministic tests** in `src/ferits/ledger/test/` using golden snapshots and reproducible randomness.
- Provide a **UI route** at `/ledger` that:
  - lets a user assume an identity,
  - shows their private balance,
  - shows the current public total,
  - demonstrates that they cannot see others' balances.
- Update the **Dashboard** (`/dashboard`) with a card linking to `/ledger` and describing “Private balances, public total verification.”
- Document how future phases will handle governance (“who is allowed to update this ledger in production”), and how this ledger can be anchored to Kerits and synced via Merits.

See [guidance](./guidance.md) for directory layout, adapter interfaces, deterministic testing, and dashboard conventions.

---

## Overview

Phase 1 implements a cryptographic ledger system where:

- Each participant sees **their own balance only**.
- The group can see and verify the **public total** across all participants.
- No central party can see individual balances unless that holder discloses them.
- Any participant can verify that the ledger hasn't been tampered with.

All ledger entries are committed as Pedersen-style commitments. Each participant’s actual balance is encrypted for them alone using X25519 + HKDF + AES-GCM (as in our current UI prototype).

All balance updates are attributable to an AID (via KeritsAdapter) and can be anchored in a verifiable event log later. This makes the ledger auditable without revealing per-user values.

This capability is directly reused by:
- `stablecoin/` (fungible asset balances, e.g. local currency, regulated token)
- `budgeting/` (committee floats, reimbursements, authorised spend)
- `fundraising/` (pledges and settlement tracking)
- salary / treasury disclosure with privacy

---

## Features

### 1. Pedersen-style commitments per participant

- Each participant’s balance `v` and blinding factor `r` are turned into a commitment `C = g^v · h^r` (Ristretto group).
- Commitments hide the value but are homomorphic, so they add cleanly.
- Commitments are public, so everyone can see “there is an entry for Alice,” but not “Alice holds 137.”

### 2. Encrypted openings per holder

- Each participant receives an encrypted opening `{ v, r }` for their own row, encrypted to their X25519 public key.
- Only that participant can decrypt their opening and confirm their own balance.
- The decrypted opening can be checked against the stored commitment to prove “this number really is my number,” without revealing it to anyone else.

### 3. Public verification of the total

- Because Pedersen commitments add, we can sum all individual commitments and compare that against the published total commitment.
- Anyone can verify the published total without learning private balances.
- If tampering occurs (changing a commitment, lying about the total), verification fails and the UI SHOULD refuse to display the group total.

### 4. Optional self-update mode (demo mode)

- In self-update mode, a user can propose “my new balance is X,” and the library will:
  - derive a new commitment and encrypted opening,
  - adjust the total deterministically,
  - return a new ledger state.
- This is allowed only if `allowSelfUpdate` is true in the ledger rules. It exists purely for demos and local iteration.
- Production deployments will use governance rules from later phases (e.g. budgeting authority, treasurer approval, quorum).

---

## Technical Architecture

### State Model

```ts
interface LedgerState {
  version: string; // e.g. "1"
  entries: Array<LedgerEntry>;
  total: LedgerTotal;
  allowSelfUpdate?: boolean; // demo / local dev only
}

interface LedgerEntry {
  holderId: string;          // participant ID / AID (or local alias in demo)
  commit: string;            // hex encoding of group element (commitment C)
  openingEncrypted: string;  // base64 encrypted JSON { v, r } only decryptable by this holder
}

interface LedgerTotal {
  T: string;                 // sum of all balances as base-10 stringified bigint
  R: string;                 // sum of all blinders as base-10 stringified bigint
  commitSum: string;         // hex encoding of sum(commit_i)
}
```

These structures MUST be re-expressed as TypeBox in `ledger.schema.ts`, with for-each-field:
- `description`
- `examples`
- who can see it (holder-only / public / internal)
- any constraints (“must be non-negative”, “must match valid AID”, etc.)

### Event Types

```ts
type LedgerEvent =
  | { type: "ledger.created"; ledger: LedgerState }
  | { type: "balance.updated"; holderId: string; newCommit: string; proof: Proof }
  | { type: "ledger.verified"; totalCommit: string; valid: boolean };
```

Requirements:
- All state transitions MUST be deterministic (same inputs → same state).
- All state transitions MUST be pure (no hidden IO).
- All state transitions MUST be signable by an AID via KeritsAdapter once governance exists.

### State Transitions

- `ledger.created` → creates a new LedgerState with commitments for each participant and an aggregate total.
- `balance.updated` → replaces one participant’s commitment + encrypted opening, recomputes totals, and returns a new LedgerState.
- `ledger.verified` → runs verification and reports whether the ledger is consistent.

All transitions MUST be covered by golden snapshot tests.

---

## Verification Protocol

### Adding a Participant (Mint / Initial Allocation)

1. Generate or provide the participant’s key material / AID.  
2. Choose `v` (initial balance) and random blinding `r`.
3. Compute commitment `C = g^v · h^r`.
4. Encrypt `{ v, r }` using participant’s X25519 public key (AES-GCM from HKDF(sharedSecret)).
5. Append entry `{ holderId, commit: C, openingEncrypted }`.
6. Update the aggregate totals `T`, `R`, `commitSum` deterministically.

### Updating a Balance

1. Holder (or authorised agent in future phases) proposes a new balance `v'`.
2. Library generates new blinding `r'`, derives new commitment `C'`, and new encrypted opening.
3. Library recomputes `T` and `R` (`T = T - oldV + newV`, same for `R`).
4. Library recomputes `commitSum`.
5. Returns a new LedgerState.

In demo mode, this is gated by `allowSelfUpdate`.  
In production, this MUST be gated by governance rules in `budgeting/` (Phase after 1).

### Public Verification

Any observer can verify that:

- `commitSum` equals the algebraic sum of all individual commitments.
- `commitSum` also equals `g^T · h^R` given the published totals `T` and `R`.

If verification fails, `publicTotal` MUST NOT be treated as valid.

---

## UI Demonstration (`/ledger`)

The `/ledger` UI MUST:
- Let a user pick/assume an identity (e.g. via `IdentityManager`).
- Show for that user:
  - their decrypted balance,
  - whether their row is valid (commitment matches decrypted opening),
  - the ledger’s current public total *only if* verification passes.
- Refuse to show a total if verification fails.
- Display other participants only as `{ holderId, commit, encryptedPreview }`, not their balances.

This UI MUST consume the real logic from `src/ferits/ledger/core/`, not mock data.

We MUST also create `/dashboard` which links here with a card like:
> **Confidential Ledger** — Private balances. Public total. Cryptographic auditability.

---

## Testing Strategy

### Golden Snapshot Tests

Every state transition MUST have golden test coverage, asserting the full returned objects. We already have most of this in `ledger.test.ts`; that should move to `src/ferits/ledger/test/ledger.spec.ts` and be updated to refer to the new module surface.

Golden snapshot coverage MUST include:

- Ledger creation with single / multiple participants
- Ledger with zero values
- Ledger with large values
- Successful verification
- Failed verification after tampering with:
  - a commitment
  - a total
  - the aggregate commitment sum
- Per-user views (I see me, I don’t see you)
- Tampered openings (decryption fails or mismatch between opening and commit)

### Deterministic Randomness

Random values (blindings, nonces, ephemeral keys) MUST be controllable in tests.

We will:
- expose `randomBytes()` from `ledger.impl.ts` so tests can stub it, OR
- provide `fixtures.ts` in `test/` that monkeypatches deterministic randomness for snapshot stability.

Golden snapshot tests are only valid with reproducible randomness.

---

## Governance, Anchoring, Sync

Phase 1 does NOT enforce real-world authority yet. Instead:
- We allow `allowSelfUpdate` in demo mode so we can develop UX and mental models quickly.

Future phases will add:
- role-based or quorum-based authority in `budgeting/`,
- delegate bots that apply updates on behalf of a group under signed governance rules,
- explicit “treasurer” / “steward” roles as Kerits credentials.

Anchoring:
- Each `ledger.created` / `balance.updated` event SHOULD be signable by the relevant AID and MAY be anchored into a Kerits TEL for auditability.
- We expose that via `KeritsAdapter` once wired.

Sync:
- A LedgerState MAY be broadcast to a group with `MeritsAdapter.broadcast(group, message)` so members stay in sync without a central database.

These integration points MUST be described here, even if mocked in 1.

---

## Success Criteria

Phase 1 is complete when:

1. ✅ `src/ferits/ledger/core/` exists with deterministic, replayable ledger logic.
2. ✅ `ledger.schema.ts` defines TypeBox schemas for:
   - full internal ledger state,
   - per-user/private view,
   - public summary view.  
   Each field has `description`, `examples`, and visibility notes.
3. ✅ Golden snapshot + property tests live in `src/ferits/ledger/test/` and pass with deterministic randomness.
4. ✅ `/ledger` route renders a working UI that uses real ledger logic (identity picker, my balance, group total, tamper warnings).
5. ✅ `/dashboard` route exists with a card linking to `/ledger` and describing: “Private balances. Public total. Cryptographic auditability.”
6. ✅ Governance / anchoring / sync assumptions are documented in this file (who SHOULD be allowed to update in production, and how we’ll sign + broadcast states in future phases).
7. ✅ This document references `guidance.md`.

After 1 is complete, the `stablecoin/` module can layer fungible token semantics (mint/burn/transfer) on top of this ledger without re-solving privacy or auditability.
