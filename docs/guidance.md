# Ferits Development Guidance

This document defines cross-cutting rules for all Ferits capabilities.  
Every capability we ship (ledger, stablecoin, budgeting, fundraising, governance, permits, marketplace, etc.) MUST follow these guidelines.

Deviations should be documented explicitly in that capability’s phase document.

---

## 1. Architecture Principles

### 1.1 Separation of Concerns

Each capability MUST ship:
- A **core library module** (business logic, no UI, no network).
- A **UI module** (minimal interactive surface in the app that proves it works for humans).
- **Tests** (deterministic, snapshot-friendly).

No capability is allowed to introduce tight coupling between:
- Ferits and Kerits internals,
- Ferits and Merits internals,
- UI components and state transition logic.

All external concerns must go through adapters/ports.

We are building composable abilities (ledger, assets, budgeting, governance, permits, marketplace), **not** a single monolith. Capabilities should live in their own self-contained folders by functional responsibility, e.g.:

```txt
src/
  ferits/
    ledger/            # confidential ledger (private balances / public total)
    stablecoin/        # generalised fungible asset / mint / transfer / burn
    budgeting/         # budgets, reimbursements, approvals
    fundraising/       # pledges -> settlement
    governance/        # priorities vs execution, weighted/quadratic voting
    permits/           # scarce rights / resource caps
    marketplace/       # trust graph / matching of skills, needs, capital
```

Note: we do **not** bake roadmap/phase numbers into directory names. The directory names reflect **what the module does**, not when it appeared on the roadmap.

Each module keeps single responsibility. For example:
- `ledger/` covers confidential ledgers.
- `stablecoin/` is generic stable/community token logic (EyamCoin etc. are deployments).
- `governance/` covers weighted / quadratic voting and mandate assignment.

If a module later supports multiple use-cases (e.g. `stablecoin/` also issues tickets), we extend that module rather than cloning it.

---

### 1.2 Ports and Adapters

Any usage of identity, signing, credentials, group membership, or messaging MUST go through explicit interfaces:

```ts
// src/adapters/kerits.adapter.ts
export interface KeritsAdapter {
  whoAmI(): AID;
  sign(payload: Uint8Array): Promise<Signature>;
  verify(sig: Signature, payload: Uint8Array, aid: AID): Promise<boolean>;
  getCredentials(aid: AID): Promise<CredentialSet>; // e.g. "is over 18", "is resident"
}

// src/adapters/merits.adapter.ts
export interface MeritsAdapter {
  send(to: AID, message: Message): Promise<void>;
  broadcast(group: GroupId, message: Message): Promise<void>;
  onMessage(handler: (msg: Message) => void): void;
}
```

Rules:
- Ferits core logic modules (`ledger/`, `stablecoin/`, etc.) MUST NOT import Kerits or Merits internals directly.
- During development, tests and demos MUST be able to run with simple in-memory mocks of these adapters.
- Production builds can swap in real Kerits/Merits implementations.

This keeps Ferits independently testable and portable.

---

## 2. Directory / Namespace Layout

Each Ferits capability should have a predictable structure with parallel concerns:

```txt
src/
  ferits/
    ledger/
      core/
        ledger.api.ts        # public interface surface
        ledger.schema.ts     # TypeBox schemas (+ docs + examples)
        ledger.impl.ts       # implementation of business logic
        ledger.verify.ts     # math / crypto verification helpers
      test/
        ledger.spec.ts       # golden snapshot & property tests
        fixtures.ts          # deterministic keys, fixed randomness stubs
      ui/
        LedgerPage.tsx       # demo UI route for this capability (e.g. /ledger)
        components/
          IdentityManager.tsx
          LedgerSpreadsheet.tsx

  adapters/
    kerits.adapter.ts        # identity/cred interface + mock impl
    merits.adapter.ts        # messaging/sync interface + mock impl

src/pages/
  DashboardPage.tsx          # capability dashboard
  LedgerPage.tsx             # thin wrapper that renders ferits/ledger/ui/LedgerPage
```

Conventions:
- Logic lives in `core/` and is framework-free.
- UI lives in `ui/` and consumes `core/` via `.api.ts`, never private internals.
- Tests live under `test/` next to the capability they test.
- Anything promoted to “every module needs this” (shared math, shared UI atoms) moves to `ferits/shared/` or `components/shared/` as appropriate.

---

## 3. TypeBox Schemas

Every non-trivial data structure MUST:
1. Live in `*.schema.ts` in that capability’s `core/` directory,
2. Be defined using `@sinclair/typebox` (or our fork),
3. Provide:
   - `description` for *every* field,
   - `examples` showing real values,
   - any invariants / expectations for the field,
   - who is allowed to see/use that structure (public vs per-user vs internal).

Example pattern:

```ts
import { Type, Static } from "@sinclair/typebox";

/**
 * Public view of a ledger's aggregate state.
 * - No per-user secrets
 * - Verifiable by any participant
 */
export const LedgerPublicSummary = Type.Object({
  version: Type.String({
    description: "Ledger schema version for compatibility / migrations.",
    examples: ["1"],
  }),
  total: Type.Object({
    T: Type.String({
      description:
        "Total balance across all participants, as a base-10 stringified bigint.",
      examples: ["600", "3000000"],
    }),
    R: Type.String({
      description:
        "Blinding-factor sum, as a base-10 stringified bigint. Used to prove Pedersen commitments add up without revealing individual balances.",
      examples: ["8457392845729348572934"],
    }),
    commitSum: Type.String({
      description:
        "Compressed group element (hex). Pedersen commitment to the total. Any participant can check this against the sum of individual commitments.",
      examples: ["fabc34deadbeef..."],
    }),
  }),
}, {
  $id: "ferits/ledger/LedgerPublicSummary",
  description: "Auditable ledger total without revealing individual balances.",
});

export type LedgerPublicSummary = Static<typeof LedgerPublicSummary>;
```

Rules:
- Always include `$id` so this can later live inside an ACDC.
- Always annotate privacy/visibility (“public”, “holder-only”, “internal-use”).
- Store bigint values as strings in the schema, and document that explicitly.

Schemas double as developer contracts and as future credential formats.

---

## 4. Deterministic Testing

### 4.1 Golden Snapshot Tests

Each capability MUST include snapshot-style tests that assert full returned objects, not just tiny fragments. Example:

```ts
expect(getUserView(ledger, alice)).toEqual({
  myBalance: 100n,
  myEntryValid: true,
  publicTotal: 600n,
  others: [
    { holderId: "bob", commit: "a43f…", encrypted: "BgQA…" },
    { holderId: "carol", commit: "91dc…", encrypted: "Jwss…" }
  ]
});
```

This style:
- Documents what the API actually returns.
- Makes regressions obvious.
- Prevents silent interface drift.

Snapshot tests should cover:
- happy paths,
- tampering / invalid states,
- boundary behaviour (0 amounts, very large amounts, missing entries).

### 4.2 Deterministic Randomness

Crypto in tests MUST be reproducible.

- Randomness sources (`randomBytes`, nonces, ephemeral keys) MUST be stubbed or injected in tests so snapshot output is stable.
- If browser crypto must be used in production, expose a test hook (e.g. `setDeterministicRandom(fn)` in test env).

Golden snapshots are only meaningful if randomness is reproducible.

---

## 5. UI Requirements

Each capability MUST ship a working UI that exercises the real logic in `core/`.

Requirements:
1. The UI is reachable from the shared Dashboard.
   - Example: `/ledger` for the confidential ledger capability.
2. The UI should display:
   - The “public”/group view (e.g. total, aggregate state),
   - The “per-user”/private view (e.g. my balance).
3. The UI should clearly demonstrate constraints / guarantees, not just raw data.
   - “You can see your own balance but not theirs.”
   - “The group can verify the total is £600 without seeing who has what.”

The UI is not a toy. Its job is to prove that a non-cryptographer can actually *use* this capability.

---

## 6. Dashboard

We maintain a “capability dashboard” page that acts as the landing screen for Ferits.

- `/dashboard` lists all available capabilities as cards.
  - “Confidential Ledger (Private balances, public total)” → `/ledger`
  - Future: “Stablecoin (Community Token)” → `/stablecoin`
  - Future: “Budgets & Reimbursements” → `/budgeting`
  - etc.
- Each card briefly describes the value of that capability.

Every new capability MUST update the dashboard with:
- A card,
- A route link,
- A one-sentence value proposition.

This keeps demos investor-ready and makes scope visible.

---

## 7. Governance & Anchoring

Each capability MUST document how its artefacts can be governed and anchored, even if that governance is not implemented yet.

Specifically:
- How updates SHOULD eventually be authorised (treasurer? quorum? delegate bot? role-based AIDs?).
- How events COULD be anchored into Kerits (e.g. signed TEL entry for audit).
- How state COULD be synchronised via Merits (e.g. broadcast ledger update to a group).

This does not mean every phase implements governance.  
It means every phase is explicit about who *should* be allowed to mutate state in production.

---

## 8. Deliverable Checklist for Each Capability / Phase

Every phase MUST end with a checklist like the following, and that checklist MUST pass before the phase is considered “done”:

- [ ] `core/*.impl.ts` logic complete with pure, deterministic state transitions
- [ ] `core/*.schema.ts` TypeBox schemas with descriptions, examples, and visibility rules
- [ ] deterministic tests passing in `test/*.spec.ts` (golden snapshots + property tests)
- [ ] UI route added (e.g. `/ledger`) using real logic, not mock data
- [ ] Dashboard updated with a card linking to that route
- [ ] Governance/anchoring notes included in the phase doc
- [ ] This guidance.md referenced in the phase doc

---

## 9. Naming Notes

- We do **not** use roadmap sequencing in folder names.  
  (`ledger/`, not `f1-ledger/`; `stablecoin/`, not `f2-eyamcoin/`.)

- “Stablecoin” is the generic capability for fungible/community tokens.  
  “EyamCoin” is an example deployment/use-case of that module (local reserve-backed token, age-gated variant, etc.).

- “permits/” should not be hard-coded to “AirbnbCap”. It should express a general scarce-rights model usable for rentals, fishing quotas, parking slots, emission caps, etc.

This keeps Ferits general and prevents us from baking one political story into the code surface.

---

## 10. Philosophy

Ferits is not “the app.”  
Ferits is the **application substrate**: confidential ledgers, programmable assets, accountable budgeting, participatory governance, scarce resource rights, and a trust-routed marketplace.

Every capability we ship should:
- stand alone,
- compose cleanly with others,
- and feel immediately useful to normal people.
