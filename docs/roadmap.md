# Roadmap — Application Tier / DSD Layer

Goal: We want to model digital assets and digital security depositories in an intuitive, user-friendly way built on top of a 'Kerits' (KERI) implementation which can be used as "your personal blockchain" using KEL for essentially 'proof of authority'.

## Overview

The focus is to show how verifiable, append-only data (TELs and ACDCs) can represent budgets, balances, and commitments between human participants and organizations. 

The following examples build on a foundation of:
 * kerits - a typescript keri implementation which can be run anywhere (browser, laptop, cloud, etc) in a way which makes it both a secure key management and distributed, multi-compute platform
 * merits - a secure messaging layer which allows participants to message each other via AID or via groups. This gives us 'discoverability' and secure message protocol (we can replicate data, ask for data from participants, and have our network forward on messages to discover services or markets)

This is our 'financial' app layer, or 'ferits', which will demonstrate digital assets which can be encumbered with rules, and atomically settled.

# Use-Cases

Throughout these examples, usability will be a key consideration. In practice, there will be a kind of 'whats-app' messaging experience, where people can branch off to create new groups or sub-groups. Those groups will be delegate AIDs with multi-sig authority by the group under-the-hood, and will be able to create digital assets and DSDs as ledgers stored on TELs. The software will just use naming conventions to show what assets / balances a group has, and they will use merits to share data. Often-times when software is needed to update the state of a ledger, that can be done by a delegete AID of that group -- a "bot" that follows the governance and rules of the asset and makes updates with the requisite proofs that those rules have been obeyed.

## An 'EyamCoin' stablecoin

This will demonstrate that currency is just a promise to deliver a specified value (a ticket, a favor, a service, some fiat currency, etc), and that only the parties involved are needed for 'finality' -- e.g. to witness and verify the integrity of a ledger tracking these promises.

We will have other examples to follow about tickets, fund-raising, and committee budges. Many of the people involved in all of these things already interact in the real world, and would benefit from knowing an 'EyamCoin' stablecoin can be easily redeemed when needed. As people grow to understand and trust that, they will be able to think about the 'EyamCoin' as trustable currency.

## An "EyamCoinA" adult stablecoins

EyamCoinA can only be held by users (AIDs) who have a proof they are over 18. Over-18 users can easily exchange EyamCoins for EyamCoinAs with zero fees - the DSD which tracks the balances simply need to witness that balance update (e.g. Alice used to have 10 EyamCoin and 2 EyamCoinA, and now holds 3 EyamCoin and 9 EyamCoinA. That transaction was done to make a payment at a vendor who only accepts EyamCoinA - a transaction which was witnessed by the EyamCoin and EyamCoinA, Vendor and Alice participants).

The ledger balances themselves show the totals (anybody with EyamCoin or EyamCoinA can see the total supply), but only members can see their balances. That functionality is already demonstrated in our [ledger](../src/lib/ledger.ts)


## Eyam PTFA

The PTFA has their own group for agreeing budgets and approving spending. Everyone knows each other, so there is a lot of trust, but also friction where members spend money not allocated and approved by the group. This is potentially concerning, as there are meeting minutes which agree the budgets, which are then not respected.


Participants can use ferets to claim expenses against budgets. These transactions can be approved / accepted by the group (or a delegate AID to automate this), and members can easily settle remaining balances while still having fully audited accounts and clear visibility of funds. For example, if there is a fund raiser where two PTFA members are on a stall selling sweets, the committee may have agreed an expenditure of £50 for sweets to sell, and for £100 from the committee to be used as a fiat cash 'float' for issuing change to punters.

The committe members may have purchased £23 of sweets from their own personal funds (which could be submitted/tracked by the DSD against that budget for that event). They may then elect to simply take £23 from the cash available, and later the committee counts up the cash raised from the event.

Another committee member may just take all the cash for their personal use, and simply transfer the equivalent amount to the PTFA bank account.

All of these transactions can be part of the recorded, auditable ledger, allowing everyone to act much more easily than having to bring money to the bank, or not reimburse themselves for already agreed budgets and funds

## Tickets

We should be able to easily 'mint' digital assets, such as tickets to events. Those tickets can be verified to be held by an AID (e.g., the person verifying someone has a ticket only know their AID, though there may have been some governance applied when issuing the ticket which describes who is allowed to hold it). This way we can have local tickets (and prices) for locals, or children, or venders. Assigning prices and restrictions on tickets should be easy, with discretionary disclosure of data and a clear separation of roles.

Those tickets may or may not be transferrable or redeemable for refunds, etc.

## Fundraising

We should be able to take a vote on a priority within a group, and then represent "Can we all agree to give £5 to this". Those commitments can then be redeemed / settled, showing the outstanding commitments and accruals and settled donations as 'actuals', delegating a chosen account (AID) of our chosing for the escrow of those funds, and without revealing any information about individuals' information, but still being able to publicly share the accruals/actuals ledger where each participant can see their own row entry, and all participants can see the ledger total



---


## Principles

- **Strict layering:** The DSD layer *uses* Kerits primitives but never redefines them.
- **Core = protocol, App = semantics:**  
  Core defines KEL, TEL, ACDC; App defines *what they mean* (budget, balance, payment, etc.).
- **Reusable governance hierarchy:** The same logic can represent Eyam‑Coin, Hope‑Valley‑Coin, or other local/community funds.
- **Transparency without blockchain:** Verifiable logs replace distributed consensus — signatures and delegation are the “consensus.”
- **Extensible and white‑labelable:** Each use‑case (PTA, sports club, parish fund) is just a new AID tree and TEL schema.

---

## Phase 1 — DSD Layer Foundation

**Outcome:** Establish `src/lib/dsd` structure and minimal shared utilities.

- Create folder structure and lint/test setup.
- Add shared TypeBox schema helper for DSD applications.
- Add `world-scenario.md` and test harness stub `world.test.ts`.
- Define naming conventions for application-level AIDs, TELs, and ACDCs.

**DoD:** Repo boots with new app layer; DSD unit tests and folder structure validated.

---

## Phase 2 — Domain TEL Schemas

**Outcome:** Application-level TEL types representing financial and social events.

- `budget-tel.schema.ts` — allocations from treasury to committees.
- `committee-spend-tel.schema.ts` — spending and income for committees.
- `p2p-obligation-tel.schema.ts` — bilateral debts and settlements between individuals.

Each TEL schema extends the core TEL structure with a `kind` and domain-specific body.

**DoD:** Deterministic golden vectors for each TEL type; signatures and SAIDs verifiable using core `verifyTelEntry()`.

---

## Phase 3 — Balance Attestations (ACDC Profiles)

**Outcome:** Define profiled ACDCs in DSD, starting with `balance-attestation`.

- `balance-attestation.schema.ts` — defines body and claims structure (allocated/spent/remaining).
- `balance-attestation.api.ts` — build, issue, and verify logic using core ACDC APIs.
- Supports EyamTreasury → BonfireCommittee style attestations.

**DoD:** Issued BalanceAttestations verify offline using published OOBIs; deterministic vectors in `vectors/balance-attestation.json`.

---

## Phase 4 — World Test: Eyam‑Coin Scenario

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
