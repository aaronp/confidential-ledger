# Phase F1 — Private Balances / Public Totals Ledger

> **Goal:** Shared ledger with per-user privacy and global auditability.

---

## Overview

Phase F1 implements a cryptographic ledger system where:
- Each participant's balance remains **private** (visible only to them)
- The **total** across all participants is **publicly verifiable**
- No central authority can see individual balances
- Everyone can verify the ledger's integrity

This is achieved using Pedersen-style commitments with encrypted "openings" per holder.

---

## Features

### Core Capabilities

1. **Pedersen-style commitments per participant**
   - Each balance is represented as a cryptographic commitment
   - Commitments hide the value while allowing mathematical operations
   - Homomorphic properties enable summing commitments

2. **Encrypted "openings" per holder**
   - Each participant holds an encrypted opening revealing their balance
   - Only the participant can decrypt and verify their own balance
   - Openings prove the commitment corresponds to the claimed value

3. **Public verification of total correctness**
   - Sum of all commitments can be verified against the total
   - Anyone can audit that the ledger balances correctly
   - No need to see individual values

4. **Optional self-update flag for local demos**
   - Participants can self-update their balances in demo mode
   - Useful for testing and local development
   - Real deployments use governance rules for updates

---

## Impact & Dependencies

**Impact:** 💰 **High**
Enables money, budgets, and trust visualisation — foundational for financial use-cases.

**Effort:** ⚙️ **Medium**
PoC already exists, needs productionisation and integration.

**Dependencies:**
- F0 (Core Skeleton) must be complete

**Feeds into:**
- F2 — EyamCoin (community tokens)
- F3 — Budgets & Expense Governance
- F4 — Fundraising & Pledges

---

## Technical Architecture

### State Model

```ts
interface PrivateBalanceLedger {
  id: LedgerId;
  participants: Map<AID, ParticipantEntry>;
  totalCommitment: Commitment;
  rules: LedgerRules;
}

interface ParticipantEntry {
  commitment: Commitment;      // Public: C = g^v · h^r
  encryptedOpening: Encrypted; // Private: {value, blinding}
  lastUpdated: Timestamp;
}
```

### Event Types

```ts
type LedgerEvent =
  | { type: 'ledger.created'; ledgerId: LedgerId; rules: LedgerRules }
  | { type: 'participant.added'; aid: AID; initialCommitment: Commitment }
  | { type: 'balance.updated'; aid: AID; newCommitment: Commitment; proof: Proof }
  | { type: 'total.verified'; totalCommitment: Commitment; valid: boolean };
```

### State Transitions

All state transitions must be:
- **Deterministic:** Same events → same state
- **Verifiable:** Signed by authorized participants
- **Auditable:** Full event log retained
- **Testable:** Golden snapshots for every transition

---

## Verification Protocol

### Adding a Participant

1. Participant generates initial commitment `C = g^v · h^r`
2. Stores encrypted opening `E_k({v, r})`
3. Broadcasts commitment to ledger
4. Total commitment updated: `Total' = Total · C`

### Updating a Balance

1. Participant generates new commitment `C'`
2. Proves knowledge of old opening (ZK proof)
3. Provides range proof (optional: balance ≥ 0)
4. Updates encrypted opening
5. Ledger updates participant's commitment
6. Total commitment adjusted accordingly

### Public Verification

Anyone can verify:
```
Sum(all_commitments) == TotalCommitment
```

Without learning any individual balance.

---

## Demo Scenarios

### Scenario 1: Local Group Budget
- 5 participants each contribute different amounts
- Each sees only their own balance
- All can verify the total matches expected sum
- Treasurer can audit without seeing individual contributions

### Scenario 2: Salary Confidentiality
- Organization publishes total salary budget commitment
- Employees verify their individual salaries
- Public can verify organization doesn't exceed budget
- Individual salaries remain private

---

## Implementation Checklist

- [ ] Define ledger state schema
- [ ] Implement Pedersen commitment primitives
- [ ] Create encrypted opening mechanism
- [ ] Build state transition functions
- [ ] Add ZK proof verification
- [ ] Write golden snapshot tests
- [ ] Create CLI inspector tool
- [ ] Build minimal UI for balance viewing
- [ ] Document cryptographic protocol
- [ ] Add self-update mode for demos

---

## Testing Strategy

### Golden Snapshot Tests

Every state transition must have golden test:
- Initial ledger creation
- Adding first participant
- Adding multiple participants
- Balance updates (increase/decrease)
- Total verification
- Error cases (invalid proofs, unauthorized updates)

### Property-Based Tests

- Homomorphic property: `C1 · C2 = C(v1 + v2)`
- Total always equals sum of parts
- No negative balances (with range proofs)
- Replay protection (nonces/timestamps)

---

## Security Considerations

1. **Commitment Binding**
   - Once committed, value cannot be changed without detection
   - Requires discrete log hardness

2. **Opening Privacy**
   - Encrypted with participant's key
   - Only participant can decrypt
   - Loss of key = loss of balance proof

3. **Range Proofs**
   - Prevent negative balances
   - Prevent overflow attacks
   - Optional based on use-case

4. **Replay Protection**
   - Events include nonces or timestamps
   - Prevents double-application of updates

---

## Success Criteria

Phase F1 is complete when:

1. ✅ Ledger can be created with multiple participants
2. ✅ Each participant can see only their own balance
3. ✅ Anyone can verify the public total
4. ✅ Balance updates are cryptographically sound
5. ✅ All state transitions have passing golden tests
6. ✅ CLI tool can inspect ledger state
7. ✅ UI can display private balance + public total
8. ✅ Documentation explains the protocol clearly

---

## Next Steps

After F1 completion:
- **F2** builds token semantics on top of this ledger
- **F3** uses ledger for budget tracking
- **F4** leverages it for pledge/fundraising transparency

Phase F1 is the **financial foundation** of Ferits.
