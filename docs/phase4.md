# Phase F4 — Fundraising & Pledges

> **Goal:** Record and reconcile community commitments with private pledges and public totals.

**Conforms to:** [guidance.md](./guidance.md)

**Dependencies:** Phase F1 (Ledger), Phase F2 (Tokens)

---

## Overview

Phase F4 (Fundraising & Pledges) enables communities to coordinate **collective commitments** before money changes hands.

**Key Insight:** Pledges are *commitments to pay*, not immediate transfers. This allows:
- Anonymous pledge amounts (private rows, public total)
- Target tracking with percentage funded
- Settlement workflow when target is met
- Cancellation/refund if target not reached

**Use Cases:**
- PTFA school trip fundraising: "We need £5000 for the Edinburgh trip"
- Community pantry donations: "Monthly goal: £500 for food supplies"
- Local project crowdfunding: "Repair community hall roof — £15,000 target"

---

## Core Concepts

### Pledge

A **commitment** to contribute a specific amount to a campaign. Pledges are:
- **Private:** Individual amounts encrypted (like ledger entries)
- **Binding:** Signed commitment by pledger
- **Conditional:** Only charged if campaign reaches target

### Campaign

A **fundraising goal** with:
- Target amount
- Deadline
- Beneficiary (budget, project, or treasury)
- Status: `draft` → `active` → `funded` | `failed` → `settled`

### Settlement

When a campaign succeeds:
1. Pledges convert to actual token transfers
2. Funds move from pledgers to beneficiary treasury
3. Campaign closes with auditable record

When a campaign fails:
- Pledges cancelled
- No funds transferred
- Campaign marked `failed`

---

## Schema Design

Following `guidance.md` patterns, all schemas use **TypeBox** with descriptions, examples, and visibility notes.

### PledgeEntry

```ts
export const PledgeEntry = Type.Object({
  pledgerId: Type.String({
    description: "AID of the pledger",
    examples: ["did:keri:user_alice"],
    visibility: "public"
  }),
  commit: Type.String({
    description: "Pedersen commitment to pledge amount: C = G×amount + H×r",
    examples: ["rist255:AaB..."],
    visibility: "public"
  }),
  openingEncrypted: Type.String({
    description: "Encrypted {amount, r} using pledger's X25519 public key",
    examples: ["x25519-hkdf-aes256gcm:..."],
    visibility: "public (but only pledger can decrypt)"
  }),
  signedAt: Type.Number({
    description: "Timestamp when pledge was signed",
    visibility: "public"
  }),
  signature: Type.Optional(Type.String({
    description: "Signature over canonicalized pledge commitment",
    visibility: "public (production mode)"
  }))
}, { $id: "ferits/fundraising/PledgeEntry" });
```

### Campaign

```ts
export const Campaign = Type.Object({
  version: Type.String({
    description: "Schema version",
    examples: ["1"]
  }),
  campaignId: Type.String({
    description: "Unique campaign identifier",
    examples: ["campaign_trip_2025"]
  }),
  name: Type.String({
    description: "Human-readable campaign name",
    examples: ["Edinburgh School Trip 2025"]
  }),
  description: Type.String({
    description: "Campaign purpose and details",
    examples: ["Fundraising for annual school trip to Edinburgh"]
  }),
  targetAmount: Type.String({
    description: "Goal amount as bigint string",
    examples: ["5000"]
  }),
  deadline: Type.Number({
    description: "Timestamp when campaign closes",
    visibility: "public"
  }),
  beneficiary: Type.Object({
    type: Type.Union([
      Type.Literal("budget"),
      Type.Literal("treasury"),
      Type.Literal("project")
    ]),
    id: Type.String({
      description: "Budget ID, asset ID, or project ID",
      examples: ["budget_trip_2025"]
    })
  }),
  pledges: Type.Array(PledgeEntry, {
    description: "List of pledge commitments"
  }),
  totalCommit: Type.String({
    description: "Sum of all pledge commitments",
    visibility: "public (allows verification)"
  }),
  status: Type.Union([
    Type.Literal("draft"),
    Type.Literal("active"),
    Type.Literal("funded"),
    Type.Literal("failed"),
    Type.Literal("settled")
  ]),
  createdAt: Type.Number(),
  createdBy: Type.String({
    description: "AID of campaign creator",
    examples: ["did:keri:ptfa_chair"]
  }),
  settledAt: Type.Optional(Type.Number({
    description: "Timestamp when settlement completed"
  })),
  assetId: Type.Optional(Type.String({
    description: "Asset ID for token transfers (EyamCoin)",
    examples: ["eyamcoin_main"]
  }))
}, { $id: "ferits/fundraising/Campaign" });
```

### CampaignSummary (Public View)

```ts
export const CampaignSummary = Type.Object({
  campaignId: Type.String(),
  name: Type.String(),
  description: Type.String(),
  targetAmount: Type.String(),
  pledgedAmount: Type.String({
    description: "Verified sum of all pledges (if valid)",
    visibility: "public"
  }),
  percentFunded: Type.Number({
    description: "Percentage toward goal: (pledged / target) * 100",
    examples: [75.5]
  }),
  pledgeCount: Type.Number({
    description: "Number of pledgers",
    visibility: "public"
  }),
  status: Type.String(),
  deadline: Type.Number(),
  daysRemaining: Type.Number({
    description: "Days until deadline",
    examples: [14]
  }),
  isVerified: Type.Boolean({
    description: "True if commitment sum verification passes"
  })
}, { $id: "ferits/fundraising/CampaignSummary" });
```

---

## State Transitions

All operations are **pure, deterministic functions** returning new state.

### 1. Create Campaign

```ts
function createCampaign(params: {
  campaignId: string;
  name: string;
  description: string;
  targetAmount: string; // bigint
  deadline: number; // timestamp
  beneficiary: { type: "budget" | "treasury" | "project"; id: string };
  createdBy: string; // AID
  assetId?: string; // for token-based campaigns
}): Campaign;
```

**Validation:**
- Target amount > 0
- Deadline in future
- Beneficiary exists (for production mode)
- Creator has `campaign_creator` credential (production mode)

**Initial State:**
- `status: "draft"`
- `pledges: []`
- `totalCommit: "0"`

### 2. Activate Campaign

```ts
function activateCampaign(campaign: Campaign): Campaign;
```

**Validation:**
- Current status is `draft`
- Campaign has valid target and deadline

**Result:**
- `status: "active"`

### 3. Submit Pledge

```ts
function submitPledge(
  campaign: Campaign,
  params: {
    pledgerId: string; // AID
    amount: string; // bigint
    blinding: Uint8Array; // r
    recipientPublicKey: Uint8Array; // for encryption
  }
): Campaign;
```

**Process:**
1. Create Pedersen commitment: `C = G×amount + H×r`
2. Encrypt opening: `{amount, r}` using pledger's X25519 key
3. Sign pledge commitment (production mode)
4. Add to campaign pledges
5. Update `totalCommit` sum

**Validation:**
- Campaign status is `active`
- Deadline not passed
- Amount > 0
- No duplicate pledge from same pledger (optional rule)

**Privacy:**
- Individual pledge amounts encrypted
- Only total commitment public
- Pledger can decrypt their own amount

### 4. Verify Campaign Total

```ts
function verifyCampaignTotal(campaign: Campaign): boolean;
```

**Process:**
1. Sum all pledge commitments: `Csum = ΣCi`
2. Compare to stored `totalCommit`
3. Return true if match

**Like F1 ledger verification** — anyone can verify the total without seeing individual amounts.

### 5. Check Funding Status

```ts
function checkFundingStatus(
  campaign: Campaign,
  decryptedAmounts: Map<string, bigint>
): { isFunded: boolean; totalPledged: bigint };
```

**Process:**
1. Decrypt all pledge openings (requires each pledger's key)
2. Sum decrypted amounts
3. Compare to target
4. Return funding status

**Note:** In production, this would use threshold decryption or trusted observers to verify without exposing individual amounts.

### 6. Close Campaign

```ts
function closeCampaign(campaign: Campaign): Campaign;
```

**Validation:**
- Deadline passed OR funding target reached
- Status is `active`

**Result:**
- `status: "funded"` if target met
- `status: "failed"` if target not met

### 7. Settle Campaign

```ts
function settleCampaign(
  campaign: Campaign,
  asset: AssetState, // from F2
  pledgeOpenings: Map<string, { amount: string; r: Uint8Array }>
): { campaign: Campaign; asset: AssetState };
```

**Process (if funded):**
1. Verify all pledge openings match commitments
2. Create token transfers from each pledger to beneficiary
3. Update asset state (F2 transfer operations)
4. Mark campaign as `settled`

**Process (if failed):**
- Mark campaign as `settled` (no transfers)
- Pledges cancelled

**Integration with F2:**
- Uses `transfer()` operations from stablecoin module
- Each pledge becomes a transfer in the asset ledger
- Beneficiary receives sum of all pledges

---

## Privacy Model

Following F1 architecture:

| Data | Visibility |
|------|-----------|
| Campaign name, target, deadline | Public |
| Individual pledge amounts | Private (encrypted per pledger) |
| Total pledged (commitment sum) | Public & verifiable |
| Pledger identities (AIDs) | Public |
| Settlement transfers | Private (encrypted ledger entries) |

**Verification Without Decryption:**
- Anyone can verify `Csum = ΣCi` matches stored total
- Campaign organizer can prove "we have enough pledges"
- Individual amounts remain private until settlement

**Optional Anonymity:**
- For fully anonymous pledges, use ring signatures or one-time AIDs
- Trade-off: harder to contact pledgers for settlement

---

## UI Requirements (`/fundraising`)

### Campaign Dashboard

**Features:**
- List of active campaigns
- Campaign cards showing:
  - Name and description
  - Target amount
  - Pledged amount (verified total)
  - Progress bar with percentage
  - Days remaining
  - "Pledge" button

### Campaign Detail View

**Sections:**
1. **Overview:**
   - Full description
   - Target and current pledged amount
   - Deadline countdown
   - Status badge

2. **Pledge Form:**
   - Amount input
   - Optional message
   - "Commit Pledge" button
   - Shows user's existing pledge (if any)

3. **Pledge List:**
   - Anonymous list: "35 pledges"
   - Or list of pledger AIDs (without amounts)
   - Verification status indicator

4. **Settlement Status:**
   - For `funded` campaigns: "Target reached! Settlement in progress..."
   - For `failed` campaigns: "Campaign did not reach target. Pledges cancelled."
   - For `settled` campaigns: "Completed. Funds transferred to beneficiary."

### Create Campaign Form

**Fields:**
- Campaign name
- Description (markdown)
- Target amount
- Deadline (date picker)
- Beneficiary type (budget/treasury/project)
- Beneficiary ID (dropdown)
- Asset ID (for token campaigns)

---

## Testing Strategy

### Golden Snapshot Tests

**Coverage:**
- Campaign creation with valid/invalid params
- Pledge submission (single and multiple)
- Total commitment verification
- Funding status checks
- Campaign closure (funded and failed)
- Settlement with token transfers
- Deadline expiry handling

### Property Tests

**Invariants:**
- Total commitment always equals sum of pledge commitments
- Campaign status transitions are valid: `draft → active → {funded|failed} → settled`
- Pledges can only be added to `active` campaigns
- Settlement only occurs for `funded` or `failed` campaigns
- Individual pledge amounts decrypt correctly
- Sum of decrypted amounts matches verified total

### Integration Tests

**F1 + F2 + F4:**
- Campaign settlement creates correct ledger entries
- Token transfers reflect pledge amounts
- Beneficiary treasury balance increases by pledged total
- Privacy maintained throughout workflow

---

## Use Case: PTFA School Trip

**Scenario:** Parent-Teacher-Friends Association raising £5000 for Edinburgh trip.

### Step 1: Create Campaign

```ts
const campaign = createCampaign({
  campaignId: "campaign_trip_2025",
  name: "Edinburgh School Trip 2025",
  description: "Annual school trip for Year 6 students...",
  targetAmount: "5000",
  deadline: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
  beneficiary: { type: "budget", id: "budget_trip_2025" },
  createdBy: "did:keri:ptfa_chair",
  assetId: "gbp_stable"
});
```

### Step 2: Activate Campaign

```ts
const active = activateCampaign(campaign);
// Status: "active", open for pledges
```

### Step 3: Parents Make Pledges

```ts
let state = active;

// Parent 1 pledges £200
state = submitPledge(state, {
  pledgerId: "parent_alice",
  amount: "200",
  blinding: randomScalar(),
  recipientPublicKey: alicePublicKey
});

// Parent 2 pledges £150
state = submitPledge(state, {
  pledgerId: "parent_bob",
  amount: "150",
  blinding: randomScalar(),
  recipientPublicKey: bobPublicKey
});

// ... more pledges ...

// Check total commitment
const isValid = verifyCampaignTotal(state);
// true - anyone can verify sum without seeing amounts
```

### Step 4: Monitor Progress

```ts
const summary = getCampaignSummary(state, pledgeOpenings);
// {
//   pledgedAmount: "4800",
//   percentFunded: 96,
//   pledgeCount: 24,
//   daysRemaining: 15
// }
```

### Step 5: Campaign Reaches Target

```ts
// Total pledges reach £5000
const fundingCheck = checkFundingStatus(state, pledgeOpenings);
// { isFunded: true, totalPledged: 5000n }

const closed = closeCampaign(state);
// Status: "funded"
```

### Step 6: Settlement

```ts
const { campaign: settled, asset: updatedAsset } = settleCampaign(
  closed,
  gbpStable, // F2 asset state
  pledgeOpenings // decrypted pledge amounts
);

// Status: "settled"
// 24 token transfers created
// budget_trip_2025 receives £5000
// Parents' balances decreased by pledge amounts
```

### Result

- Budget has £5000 available
- All transfers recorded in confidential ledger
- Full audit trail of pledges → settlement
- Individual pledge amounts remain private

---

## Integration with F2 & F3

### With F2 (Tokens)

**Settlement Flow:**
```ts
// For each pledge in funded campaign:
for (const pledge of campaign.pledges) {
  const { amount } = decryptOpening(pledge.openingEncrypted);

  // Create F2 transfer
  asset = transfer(asset, {
    from: pledge.pledgerId,
    to: campaign.beneficiary.id,
    amount: amount,
    memo: `Pledge settlement: ${campaign.name}`
  });
}
```

### With F3 (Budgets)

**Campaign → Budget Allocation:**
```ts
// Settled campaign funds can go directly to budget
if (campaign.beneficiary.type === "budget") {
  const budget = getBudget(campaign.beneficiary.id);

  // Budget's treasury asset is updated by settlement
  // Budget can now approve expenses up to £5000
}
```

**Transparency:**
- Community sees fundraising target and progress
- Community sees budget spending from those funds
- End-to-end audit trail: pledge → settlement → budget → expenses

---

## Success Criteria

Phase F4 is complete when:

1. ✅ `src/ferits/fundraising/core/` exists with campaign and pledge logic
2. ✅ `fundraising.schema.ts` defines TypeBox schemas for:
   - Campaign state
   - PledgeEntry (with commitments)
   - CampaignSummary (public view)
3. ✅ Golden snapshot tests in `src/ferits/fundraising/test/` pass with deterministic randomness
4. ✅ `/fundraising` route renders working UI with campaign dashboard and pledge workflow
5. ✅ `/dashboard` card links to `/fundraising` with description: "Community crowdfunding with private pledges"
6. ✅ Integration with F2 demonstrated: settlement creates token transfers
7. ✅ This document references `guidance.md`

After F4 is complete:
- **F5** can use fundraising for governance mandate funding
- **F3** budgets can be allocated from campaign proceeds
- Real-world PTFAs and community groups can coordinate collective commitments

---

## Implementation Checklist

- [x] Define `Campaign`, `PledgeEntry`, and `CampaignSummary` schemas
- [x] Implement `createCampaign()` with validation
- [x] Implement `activateCampaign()` state transition
- [x] Implement `submitPledge()` with Pedersen commitments
- [x] Implement `verifyCampaignTotal()` verification
- [x] Implement `checkFundingStatus()` helper
- [x] Implement `closeCampaign()` deadline logic
- [x] Implement `settleCampaign()` with F2 integration
- [x] Write golden snapshot tests for all transitions
- [x] Write property tests for campaign invariants
- [x] Create campaign dashboard UI
- [x] Create campaign detail view with pledge form
- [ ] Create campaign creation form (deferred - can add pledges to existing campaigns)
- [x] Update dashboard with fundraising card
- [x] Document PTFA use case example
- [ ] Test integration with F2 token transfers (deferred - F2 transfer operations need enhancement)

---

## Next Steps

After F4 completion:
- **F5** uses campaigns for governance proposal funding
- **F2b** enables credential-gated campaign participation
- **F6** can require campaigns for community resource allocation

Phase F4 provides **collective commitment** — the coordination foundation for participatory finance.
