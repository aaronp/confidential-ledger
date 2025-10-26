# Vision: A Practical, Decentralised Web of Trust

We envision a world where every participant — human or organizational — owns their data, governs their digital identity, and can compute, transact, and collaborate across a **trust fabric** built from verifiable, append-only data.

At the heart of this system are three foundational components:

- **Kerits** — a TypeScript implementation of KERI that runs anywhere (browser, laptop, cloud). It provides cryptographic key management, event logs, and a distributed compute substrate for verifiable state.
- **Merits** — a secure messaging layer that enables peer-to-peer and group communication using AIDs. It provides network discovery, replication, and request/response semantics — allowing data, services, and participants to find one another.
- **Ferits** — the financial and asset layer, where digital commitments, budgets, and ledgers are expressed as verifiable TELs and ACDCs. Ferits make “digital promises” enforceable, auditable, and composable.

Together, these layers form a **decentralised web of trust** that enables individuals and communities to cooperate with integrity — without requiring central servers or intermediaries — while still providing a seamless, modern UX.

---

## Design Principles

- **Data Sovereignty**: Everyone controls their own keys, data, and history.
- **Composability**: Every entity (person, group, organization, asset) can issue, delegate, or verify others using standard verifiable event logs.
- **Local-first, Global-scale**: Systems work offline-first and sync naturally through Merits.
- **Verifiable Computation**: Actions and automations (“bots”) operate under signed authority and provable governance.
- **Amazing UX**: The experience feels as simple as WhatsApp — intuitive messaging, groups, and collaboration — yet powered by cryptographic trust under the hood.

---

# Use Cases

## 1. EyamCoin: Community Stablecoin

EyamCoin demonstrates that currency is simply a promise — a verifiable agreement to deliver value.  
Transactions between local participants can be witnessed directly and settled instantly, without needing banks or custodians.

Each participant holds their own ledger entries; group consensus determines supply and redemption rules.  
Finality comes from mutual verification, not centralization.

As people grow familiar with EyamCoin, it becomes a trusted local currency, backed not by fiat, but by community reputation and verifiable integrity.

---

## 2. EyamCoinA: Age-Restricted Stablecoin

EyamCoinA extends the concept of verifiable currencies to age-gated or regulated assets.  
Only AIDs with verified “over-18” credentials can hold EyamCoinA.

A seamless, zero-fee exchange exists between EyamCoin and EyamCoinA.  
Example: Alice pays a vendor that only accepts EyamCoinA; the DSD ledger automatically updates her balances and witnesses the transaction across all relevant parties.

The result is a privacy-preserving compliance mechanism — proof of eligibility without exposing identity.

---

## 3. PTFA Committee Budgets

Local organizations, like the Eyam PTFA, can use Ferits to manage budgets and spending transparently.

Each committee decision or expenditure becomes a verifiable event:
- Budgets are agreed and logged.
- Expenses are claimed and approved.
- Delegates (bots) can automatically approve or reconcile transactions under defined rules.

This allows flexible but auditable financial management:
- Cash floats can be tracked.
- Members can reimburse themselves directly.
- Final ledgers show true balances and audit trails — without needing traditional accounting systems.

---

## 4. Tickets and Events

Tickets become digital assets — verifiable and transferable under defined conditions.

AIDs can hold tickets with embedded rules (e.g. locals-only, child pricing, vendor access).  
Issuers define policies through ACDCs, allowing selective disclosure:
- Verifiers confirm a ticket is valid without learning the holder’s identity.
- Refunds or resales follow governance logic embedded in the asset.

This model enables local venues, schools, or festivals to run low-cost, trustless ticketing with built-in compliance.

---

## 5. Community Fundraising

Groups can easily create and manage fundraising campaigns:
1. Propose an initiative and set a target (e.g., “Let’s all contribute £5 to this project”).
2. Record each member’s commitment in a shared DSD ledger.
3. Automatically reconcile pledges and settlements as funds are transferred.

Each participant can view their private balance and commitments; the group sees aggregated totals.  
Transparency is achieved without revealing personal data — creating trust and accountability in local giving.

---

## 6. Economic Liquidity and Micro-Economies

There is immense latent value within communities — skills, knowledge, and micro-capital that remain undiscovered.  
Kerits, Merits, and Ferits together unlock this “social capital”.

Imagine:
- A neighborhood where a brass band, an accountant on sabbatical, and a mechanic all discover one another through verifiable skill graphs.
- Ten friends each lend £100 to fund a local venture, automatically tracked and settled via Ferits.
- A “skills-on-demand” economy emerges, where requests and offers flow securely through a web of trust.

By coupling **discretionary disclosure** (via Kerits) with **vectorized matchmaking** (via Merits), people can safely share the right information with the right peers — enabling micro-finance, peer employment, and resource exchange.

Automation agents (“personal MCPs”) can:
- Vectorize user profiles into discoverable embeddings.
- Route offers or requests through trust paths (“friend of a friend”).
- Enforce commissions or revenue sharing automatically and transparently.

This creates a **decentralized reputation economy**, where trust, contribution, and reciprocity fuel local prosperity.

---

# Community Governance and Collective Decision-Making

Modern governance fails in two predictable ways:
1. Power pools in a few hands and becomes hard to hold accountable.
2. Participation is either symbolic (“vote every few years”) or noisy (“whoever shouts loudest wins”), not informed or proportional.

Kerits / Merits / Ferits enable a verifiable, local-first decision layer where communities can express priorities, fund execution, and audit outcomes — without surrendering control to intermediaries.

---

## 1. Verifiable Membership and Standing

Every participant has an AID, and groups can issue verifiable credentials (ACDCs) to express:
- residency (“lives in Eyam”)
- role (“teacher”, “electrician”, “treasurer”)
- stake (“contributed 30 volunteer hours”)
- impact (“lives within 100m of the proposed wind turbine”)

Governance becomes **contextual**: those most affected, qualified, or invested have appropriately weighted votes — all provable and privacy-preserving.

---

## 2. Weighted and Quadratic Voting

Different decisions deserve different mechanics:
- **Quadratic Voting** for priorities: participants spend voting credits proportional to their willingness to commit time, effort, or resources. The quadratic cost curve prevents domination while rewarding genuine passion.
- **Expert Weighting**: technical or professional votes carry more weight when verified by credential.
- **Impact Weighting**: those most affected by an outcome have proportionally higher influence.

Votes are legitimate, explainable, and scoped to context — not mere opinion polls.

---

## 3. Separation of “What” and “How”

Governance splits into two stages:

**Stage 1: Priorities (WHAT)**  
Communities decide what matters most — e.g., “Fix the playground,” “Cap short-term lets,” “Build solar microgrid.”  
This produces a public, signed list of priorities stored in a verifiable TEL.

**Stage 2: Execution (HOW)**  
Proposals to deliver on those priorities are submitted by individuals, teams, or organizations.  
Each plan includes:
- budget
- milestones
- proof of competence
- risks and timelines

Votes then select which proposal to fund. Commitments (money, time, or labor) are tracked through Ferits.  
Execution authority is granted transparently and can be revoked if performance fails.

---

## 4. Continuous, Auditable Delivery

After execution begins:
- Budgets are milestone-gated.
- Receipts, progress, and reports are appended to a TEL.
- Authority can be revoked via collective agreement.

This replaces “trust in officials” with **verifiable accountability** — turning democracy into a living, auditable process.

---

# Community Resource Stewardship: Housing and Beyond

The same principles apply to shared resources like housing, water, energy, or environmental capacity.

## The Airbnb / Housing Cap Example

### Step 1. Define the Policy
The community agrees:
> “Limit short-term rentals to 10% of housing stock.”

This becomes a verifiable policy TEL, visible to all and cryptographically anchored in time.

### Step 2. Mint Rights as Digital Permits
10%-worth of “short-term let permits” are created as Ferits digital assets.  
Each represents the right to operate one property as a short-term rental.

- Scarce by design
- Linked to specific property AIDs
- Verifiable by anyone

### Step 3. Align Incentives
Permits can be:
- fairly allocated (lottery, locals-first)
- resold or rented under policy rules
- taxed or fee-bearing to fund community projects

Locals benefit collectively from tourism rather than losing housing access to outsiders.

### Step 4. Enforce with Proof, Not Bureaucracy
Compliance is cryptographic:
- Each property presents its signed permit credential.
- Neighbors or local bodies can verify authenticity instantly.
- Violations are visible and auditable.

No central registry, no slow enforcement — just shared, verifiable truth.

---

## Beyond Housing: Resource Governance Models

The same design can govern:
- carbon credits and sustainability quotas
- fishing rights or water usage
- public parking and transport capacity
- renewable energy contributions
- community data pools or AI model access

These resources become shared, tradable, auditable rights — governed collectively.

---

# Why This Is a Step Beyond “Direct Democracy”

Direct democracy = one vote, one time.

This model = **continuous legitimacy**:
- Contextual weighting (who’s affected / qualified)
- Transparent priorities vs. execution separation
- Revocable authority tied to outcomes
- Economic flows tied directly to decisions
- Resource rights owned and steered by the community

It’s not just “better voting.”  
It’s a **prototype constitution for post-platform society**.

---

# Technical Mapping

| Layer | Function | Examples |
|-------|-----------|-----------|
| **Kerits** | Identity & Trust Fabric | AIDs, credentials, multi-sig authorities |
| **Merits** | Communication & Discovery | Encrypted messaging, proposals, coordination |
| **Ferits** | Assets & Commitments | Ledgers, budgets, permits, tokens |

These layers enable **community-scale autonomy**:
- Each user controls their own compute and storage.
- Trust is earned through verifiable behavior.
- Automation acts within transparent, provable rules.

This is the foundation for a **humane, decentralised digital society** — where communities can self-organize, exchange value, and govern together with confidence.

