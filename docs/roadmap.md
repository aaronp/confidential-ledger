# Roadmap — Application Tier / DSD Layer

Goal: We want to model digital assets and digital security depositories in an intuitive, user-friendly way built on top of a 'Kerits' (KERI) implementation which can be used as "your personal blockchain" using KEL for essentially 'proof of authority'.

## Overview

The focus is to show how verifiable, append-only data (TELs and ACDCs) can represent budgets, balances, and commitments between human participants and organizations. 

The following examples build on a foundation of:
 * kerits - a typescript keri implementation which can be run anywhere (browser, laptop, cloud, etc) in a way which makes it both a secure key management and distributed, multi-compute platform
 * merits - a secure messaging layer which allows participants to message each other via AID or via groups. This gives us 'discoverability' and secure message protocol (we can replicate data, ask for data from participants, and have our network forward on messages to discover services or markets)

This is our 'financial' app layer, or 'ferits', which will demonstrate digital assets which can be encumbered with rules, and atomically settled.

# Use-Cases


The first use-case, **Eyam‑Coin**, is a village-scale demonstration of a stablecoin-like accounting system for local groups, committees, and individuals using “proof of trust / authority” instead of mining or staking.

---

## Principles

- **Strict layering:** The DSD layer *uses* Kerits primitives but never redefines them.
- **Core = protocol, App = semantics:**  
  Core defines KEL, TEL, ACDC; App defines *what they mean* (budget, balance, payment, etc.).
- **Reusable governance hierarchy:** The same logic can represent Eyam‑Coin, Hope‑Valley‑Coin, or other local/community funds.
- **Transparency without blockchain:** Verifiable logs replace distributed consensus — signatures and delegation are the “consensus.”
- **Extensible and white‑labelable:** Each use‑case (PTA, sports club, parish fund) is just a new AID tree and TEL schema.

---

## Phase 16 — DSD Layer Foundation

**Outcome:** Establish `src/app/dsd` structure and minimal shared utilities.

- Create folder structure and lint/test setup.
- Add shared TypeBox schema helper for DSD applications.
- Add `world-scenario.md` and test harness stub `world.test.ts`.
- Define naming conventions for application-level AIDs, TELs, and ACDCs.

**DoD:** Repo boots with new app layer; DSD unit tests and folder structure validated.

---

## Phase 17 — Domain TEL Schemas

**Outcome:** Application-level TEL types representing financial and social events.

- `budget-tel.schema.ts` — allocations from treasury to committees.
- `committee-spend-tel.schema.ts` — spending and income for committees.
- `p2p-obligation-tel.schema.ts` — bilateral debts and settlements between individuals.

Each TEL schema extends the core TEL structure with a `kind` and domain-specific body.

**DoD:** Deterministic golden vectors for each TEL type; signatures and SAIDs verifiable using core `verifyTelEntry()`.

---

## Phase 18 — Balance Attestations (ACDC Profiles)

**Outcome:** Define profiled ACDCs in DSD, starting with `balance-attestation`.

- `balance-attestation.schema.ts` — defines body and claims structure (allocated/spent/remaining).
- `balance-attestation.api.ts` — build, issue, and verify logic using core ACDC APIs.
- Supports EyamTreasury → BonfireCommittee style attestations.

**DoD:** Issued BalanceAttestations verify offline using published OOBIs; deterministic vectors in `vectors/balance-attestation.json`.

---

## Phase 19 — World Test: Eyam‑Coin Scenario

**Outcome:** End‑to‑end integration test of the DSD layer using live Kerits primitives.

### Storyline
- EyamTreasury incepts with witnesses (multisig governance AID).
- Delegates authority to BonfireCommittee and PTACommittee.
- Treasury allocates funds (BudgetTEL).
- Committees spend/collect via their TELs.
- Individuals transact via P2P TELs (“10 Eyam‑Coins for a mug” → “settled”).  
- Treasury issues a BalanceAttestation ACDC summarizing current balances.

### Test Flow
1. Create KELs + OOBIs for all AIDs.
2. Create and verify TELs with signed entries.
3. Issue and verify BalanceAttestation.
4. Rebuild all data offline from static bundles and prove verifiable integrity.

**Deliverables:**
- `src/app/dsd/world.test.ts`
- `src/app/dsd/world-scenario.md` (human-readable narrative + invariants)
- Golden vectors in `src/app/dsd/vectors/`

**DoD:** Full scenario verifiable offline; TELs and ACDCs fold hierarchically through delegation chains.

---

## Phase 20 — Generalization and White‑Labeling

**Outcome:** Make the DSD layer generic enough for other local or organizational deployments.

- Parameterize top-level treasury AID and namespaces.
- Add metadata schema for branding and geographic scope (e.g. `"hope-valley"`).
- CLI or small utility for `createLocalCoin("Hope Valley")`.
- Document deployment process and static OOBI publishing workflow.

**DoD:** A new local coin can be instantiated and verified without code changes.

---

## Milestones

- **M13:** DSD Layer Foundation (`src/app/dsd/` live).
- **M14:** Domain TELs implemented.
- **M15:** BalanceAttestation profiled ACDC.
- **M16:** Eyam‑Coin World Test (integration + vectors).
- **M17:** White‑label generalization (Hope‑Valley‑Coin etc.).

---

## Out‑of‑Scope for Iteration 3

- Advanced revocation or zero‑knowledge proofs (planned for Iteration 4).
- Automated synchronization or messaging (already covered in Kerits core).
- Full web or mobile UI (to be layered later).

---

## Vision Beyond Iteration 3

Iteration 4 will bring **hardening and interoperability** — adding revocation registries, selective disclosure, rich storage adapters, and API endpoints for distributed replication and sync.

At that stage, the DSD layer will evolve into a reusable toolkit for any community or organization to operate verifiable ledgers and attestations under their own governance.

---

_This roadmap defines Phases 16–20, forming the first application‑tier iteration of Kerits — the Distributed Securities Depository (DSD) layer._
