# Ferits Roadmap

> **Goal:** Deliver the application tier for digital assets, commitments, and governance — powered by verifiable trust (Kerits) and secure connectivity (Merits), but architected as an independent, composable system.

---

## Overview

**Ferits** is the application / asset / ledger layer of the decentralised web of trust.

Where:
- **Kerits** provide identity and proof of integrity (AIDs, KELs, ACDCs)
- **Merits** provide communication and discovery (secure messaging, groups, requests)
- **Ferits** represents **what actually happens** — money, budgets, assets, and agreements.

Ferits expresses:
- Who owes what  
- Who can do what  
- Who agreed to what  
- Who is authorised to change what next

Ferits should feel like a familiar, human-centred application layer (balances, tickets, budgets, votes), while being cryptographically sound, auditable, and automatable.

---

## Core Design Principles

- **Composability over monoliths:** Build modular capabilities (ledgers, assets, governance) rather than a giant app.  
- **Deterministic state engine:** Pure functions → signed events → verifiable state.  
- **Test-first:** Use golden snapshot tests for every state transition.  
- **Port/adapter architecture:** Kerits and Merits appear only through thin interfaces.  
- **Idempotent IO:** Replays yield the same results; all state transitions are pure and verifiable.

---

## Abstraction Boundary

Ferits must **compile and run independently** of the Kerits and Merits runtimes.  
It interacts with them only through abstract interfaces.

### `KeritsAdapter` (Identity Port)

Provides cryptographic and credential operations.

```ts
interface KeritsAdapter {
  whoAmI(): AID;
  sign(payload: Uint8Array): Promise<Signature>;
  verify(sig: Signature, payload: Uint8Array, aid: AID): Promise<boolean>;
  getCredentials(aid: AID): Promise<CredentialSet>;
}
```

### `MeritsAdapter` (Messaging / Sync Port)

Handles network communication and group coordination.

```ts
interface MeritsAdapter {
  send(to: AID, message: Message): Promise<void>;
  broadcast(group: GroupId, message: Message): Promise<void>;
  onMessage(handler: (msg: Message) => void): void;
}
```

These adapters are **mockable** for local testing:
- KeritsAdapter can be a simple Ed25519 keypair mock.
- MeritsAdapter can be an in-memory event bus.

The Ferits core should never depend directly on network IO or identity state.

---

## Capability Phases (F0–F7)

Each phase represents a composable capability, not a monolithic feature.  
They are ordered by **impact**, **difficulty**, and **dependency**.

---

### **Phase F0 — Ferits Core Skeleton**

**Goal:** Establish Ferits as a standalone module with clean interfaces.

**Deliverables**
- Port/adapters for Kerits & Merits
- Deterministic state engine for asset and ledger types
- Golden snapshot tests
- Minimal CLI/UI for inspection

**Impact:** 🔥 Foundation for all later work  
**Effort:** ⚙️ Medium  
**Dependencies:** None

---

### **Phase F1 — Private Balances / Public Totals Ledger**

**Goal:** Shared ledger with per-user privacy and global auditability.

**Features**
- Pedersen-style commitments per participant
- Encrypted “openings” per holder
- Public verification of total correctness
- Optional self-update flag for local demos

**Impact:** 💰 Enables money, budgets, and trust visualisation  
**Effort:** ⚙️ Medium (PoC already exists)  
**Feeds:** F2 EyamCoin, F3 Budgets, F4 Fundraising

---

### **Phase F2 — Community Token (EyamCoin)**

**Goal:** Introduce fungible, locally-governed assets.

**Features**
- Mint/burn rules & authorities
- Transfers between holders
- Finality & reconciliation
- UI wallet for group chats

**Impact:** 🌍 Core to every financial use-case  
**Effort:** ⚙️ Medium  
**Feeds:** F2b, F3, F4

---

### **Phase F2b — Credential-Gated Assets (EyamCoinA)**

**Goal:** Extend assets with credential-based eligibility (e.g. 18+).

**Features**
- Gated ownership (requires credential)
- On-chain / off-chain credential proofs
- Zero-fee conversions between asset classes

**Impact:** 🛡 Compliance & selective disclosure pattern  
**Effort:** ⚙️ Medium-High  
**Dependencies:** F2 + KeritsAdapter credential lookup  
**Feeds:** F6 Resource Permits

---

### **Phase F3 — Budgets & Expense Governance (PTFA Flow)**

**Goal:** Model budgets, reimbursements, and approvals.

**Features**
- Budget objects (allocations, limits)
- Expense claims & approvals
- Delegate bots for automation
- Ledger integration with audit trail

**Impact:** 🧾 Transparent governance for groups  
**Effort:** ⚙️ Medium  
**Dependencies:** F1, F2  
**Feeds:** F5 Governance

---

### **Phase F4 — Fundraising & Pledges**

**Goal:** Record and reconcile community commitments.

**Features**
- Pledge → Settlement workflow
- Target tracking & percentage funded
- Private per-user rows, public totals
- Integration with EyamCoin transfers

**Impact:** 💡 Enables group projects & crowdfunding  
**Effort:** ⚙️ Low-Medium  
**Dependencies:** F1, F2

---

### **Phase F5 — Governance (Priorities vs Execution)**

**Goal:** Implement two-stage democratic process.

**Features**
1. **Priorities:** Ranked via quadratic voting  
2. **Execution Mandates:** Competitive bids with credentials & milestones  
3. Weighted votes (expertise, impact radius)  
4. Revocable authority & milestone-based funding

**Impact:** 🗳 Community decision-making revolution  
**Effort:** ⚙️ Medium-High  
**Dependencies:** F3, KeritsAdapter for credentials

---

### **Phase F6 — Scarce Permits & Resource Rights**

**Goal:** Represent limited-capacity resources as verifiable digital rights.

**Example:**  
“Only 10% of local houses can be short-term lets.”

**Features**
- Policy-defined caps  
- Minted permit assets (Ferits objects)  
- Transfer/rental under rules  
- Public auditability  
- Local verification without central databases

**Impact:** 🏘 Self-governing communities & resource equity  
**Effort:** ⚙️ High  
**Dependencies:** F2b, F5

---

### **Phase F7 — Micro-Economy & Matchmaking Graph**

**Goal:** Discover and route offers, skills, and needs via trusted paths.

**Features**
- Profile embeddings (skills, offers, requests)
- “Friend-of-friend” routing through Merits
- Private matching & negotiation
- Settlement via Ferits ledgers

**Impact:** ⚡ Unlocks local productivity & peer markets  
**Effort:** ⚙️ Medium-High  
**Dependencies:** F4, F5, MeritsAdapter

---

## Dependency Graph (Summary)

```
F0 → F1 → F2 → F2b
          ↘
           F3 → F4 → F5 → F6 → F7
```

---

## Boston Matrix — Impact vs Effort

| Quadrant | Phases | Rationale |
|-----------|--------|------------|
| **High Impact / Low–Medium Effort** | F0, F1, F2, F3, F4 | Rapid visible wins: ledgers, tokens, budgets, fundraising |
| **High Impact / Higher Effort** | F2b, F5, F6, F7 | Governance, credential-gating, resource permits, marketplace |
| **Medium Impact / Low Effort** | Ticketing, volunteer credits (sub-features of F2/F3) | Demo-friendly add-ons that humanise Ferits |

---

## Recommended Delivery Sequence

1. **F0** Core module & adapters  
2. **F1** Private-row / public-total ledger (your existing PoC)  
3. **F2** EyamCoin token model  
4. **F3** Budgets & reimbursements  
5. **F4** Pledges & fundraising  
6. **F2b** Credential-gated assets  
7. **F5** Governance (priorities → execution)  
8. **F6** Resource permits & housing caps  
9. **F7** Trust-graph micro-economy

This progression yields early community value (visible tools, local currencies, and audit trails) while building toward advanced self-governance and economic autonomy.

---

## Closing Note

Ferits is not “the app” — it is the **application substrate** of the decentralised web of trust.

Each phase is a standalone, testable capability that can be composed into real-world solutions:
- Local currencies  
- Transparent committees  
- Collective fundraising  
- Participatory governance  
- Shared resource management  
- Decentralised marketplaces

By keeping each phase modular and deterministic, Ferits can evolve as both a product and a protocol — bridging human collaboration with cryptographic confidence.
