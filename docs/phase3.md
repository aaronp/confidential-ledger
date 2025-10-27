# Phase F3 — Budgets & Expense Governance

> **Goal:** Model budgets, reimbursements, and approvals with transparent governance for groups.

---

## Overview

Phase F3 implements a **budget and expense governance** capability that enables groups to:
- Allocate budgets to committees or projects
- Submit expense claims for reimbursement
- Approve/reject claims with multi-signature or quorum
- Track spending against budgets
- Automate approvals with delegate bots
- Maintain full audit trail via ledger integration

This module builds on F1 (confidential ledger) and F2 (fungible assets) to provide transparent, accountable group spending.

**Key use case:** Parent-Teacher-Friends Association (PTFA) managing school fundraising and expenses.

**Key features:**
- **Budget Objects:** Define allocations with spending limits
- **Expense Claims:** Submit reimbursement requests with receipts
- **Approval Workflow:** Multi-party approval with configurable rules
- **Delegate Bots:** Automated approval for small expenses
- **Audit Trail:** All operations logged and verifiable
- **Privacy:** Individual expenses can be private while totals remain public

---

## Conformance to `guidance.md`

**Dependencies:**
- **Depends on:** Phase F1 (ledger) and Phase F2 (stablecoin) complete
- **Feeds into:** Phase F5 (governance), future mandate-based funding

Phase F3 MUST:

- Provide a **core module** under `src/ferits/budgeting/core/`:
  - deterministic state transitions for budget creation, expense submission, approvals
  - validation and authorization logic
  - no UI / no network assumptions
- Provide **TypeBox schemas** in `budgeting.schema.ts` with field-level descriptions, examples, and visibility notes.
- Provide **deterministic tests** in `src/ferits/budgeting/test/` using golden snapshots and reproducible randomness.
  - Tests MUST reuse deterministic `randomBytes` and fixed timestamps for snapshot stability
- Provide a **UI route** at `/budgeting` that:
  - shows budget overview with spent/remaining
  - allows expense claim submission
  - shows approval status
  - demonstrates multi-party approval workflow
- Update the **Dashboard** (`/dashboard`) with a card linking to `/budgeting` describing "Transparent budget management with expense approvals."
- Document governance assumptions: who can create budgets, who can approve expenses, how delegate bots work, and how operations are anchored and synced.

See [guidance](./guidance.md) for directory layout, adapter interfaces, deterministic testing, and dashboard conventions.

---

## Features

### 1. Budget Creation

**Purpose:** Allocate funds to a committee, project, or purpose with spending limits.

**Inputs:**
- `budgetId`: Unique identifier
- `name`: Human-readable name (e.g., "School Trip 2025")
- `description`: Purpose and scope
- `totalAllocation`: Amount allocated (from treasury or fundraising)
- `approvers`: List of AIDs who can approve expenses
- `rules`: Budget rules (spend limits, approval thresholds, delegate bot settings)

**Outputs:**
- New budget object
- Asset allocation (reserves funds from treasury)
- Event log entry

**Rules:**
- Only authorized treasurers/stewards can create budgets
- Allocation must be available in treasury
- Approvers must have valid credentials

### 2. Expense Claim Submission

**Purpose:** Request reimbursement for an approved purchase.

**Inputs:**
- `budgetId`: Which budget to charge
- `claimant`: AID requesting reimbursement
- `amount`: Amount to reimburse
- `description`: What was purchased
- `receipts`: Optional attachment hashes/URLs
- `category`: Expense category (optional)

**Outputs:**
- New expense claim (status: `pending`)
- Event log entry
- Notification to approvers

**Rules:**
- Claimant must be authorized to spend from budget
- Amount must not exceed remaining budget
- Description and receipts required (configurable)

### 3. Expense Approval

**Purpose:** Approve or reject an expense claim.

**Inputs:**
- `claimId`: Which claim to approve
- `approver`: AID approving (must be in budget approvers list)
- `decision`: `approve` or `reject`
- `reason`: Optional justification

**Outputs:**
- Updated claim status
- If approved and threshold met: transfer from budget to claimant
- Event log entry

**Rules:**
- Only designated approvers can vote
- Approval threshold (e.g., 2 of 3) must be met
- Rejected claims cannot be re-submitted (must create new claim)

### 4. Delegate Bot Automation

**Purpose:** Auto-approve small expenses to reduce friction.

**Configuration:**
- `autoApproveLimit`: Expenses under this amount auto-approve
- `autoApproveCategories`: Specific categories that auto-approve
- `requireReceipt`: Whether receipt is mandatory for auto-approval

**Behavior:**
- When expense submitted, delegate bot checks rules
- If eligible, automatically approves (signed by bot AID)
- Otherwise, routes to human approvers

### 5. Budget Monitoring

**Purpose:** Track spending and remaining allocation.

**Metrics:**
- Total allocated
- Total spent (approved expenses)
- Total pending (awaiting approval)
- Remaining available
- Expense count by category
- Top claimants

---

## Technical Architecture

### State Model

```ts
interface BudgetState {
  version: string; // e.g. "1"
  budgetId: string;
  name: string;
  description: string;
  totalAllocation: string; // base-10 stringified bigint
  approvers: AID[]; // who can approve expenses
  rules: BudgetRules;
  expenses: Expense[];
  status: "active" | "closed" | "exhausted";
  createdAt: number;
  createdBy: AID;
}

interface BudgetRules {
  approvalThreshold: number; // e.g., 2 out of 3 approvers
  requireReceipts: boolean;
  autoApprove?: {
    enabled: boolean;
    limit: string; // auto-approve if under this amount
    categories?: string[]; // specific categories that auto-approve
    delegateBot: AID; // bot that signs auto-approvals
  };
  allowedCategories?: string[]; // restrict spending to categories
  maxExpenseAmount?: string; // maximum single expense
}

interface Expense {
  id: string;
  budgetId: string;
  claimant: AID;
  amount: string; // base-10 stringified bigint
  description: string;
  category?: string;
  receipts?: string[]; // URLs or hashes
  submittedAt: number;
  status: "pending" | "approved" | "rejected" | "paid";
  approvals: Approval[];
  rejections: Rejection[];
}

interface Approval {
  approver: AID;
  timestamp: number;
  signature?: Uint8Array;
  isAutomatic?: boolean; // true if from delegate bot
}

interface Rejection {
  approver: AID;
  timestamp: number;
  reason?: string;
  signature?: Uint8Array;
}
```

### Event Types

```ts
type BudgetingEvent =
  | { type: "budget.created"; budget: BudgetState }
  | { type: "expense.submitted"; expense: Expense }
  | { type: "expense.approved"; expenseId: string; approver: AID }
  | { type: "expense.rejected"; expenseId: string; approver: AID; reason?: string }
  | { type: "expense.paid"; expenseId: string; txId: string }
  | { type: "budget.closed"; budgetId: string; reason: string };
```

### State Transitions

All state transitions MUST be:
- **Deterministic:** Same events → same state
- **Verifiable:** Signed by authorized AIDs
- **Auditable:** Full event log retained
- **Testable:** Golden snapshots for every transition

**State Transition Functions:**

```ts
async function createBudget(
  budgetId: string,
  name: string,
  description: string,
  totalAllocation: number,
  approvers: AID[],
  rules: BudgetRules,
  createdBy: AID,
  treasury: AssetState // from F2
): Promise<{ budget: BudgetState; treasury: AssetState }>;

async function submitExpense(
  budget: BudgetState,
  claimant: AID,
  amount: number,
  description: string,
  category?: string,
  receipts?: string[]
): Promise<BudgetState>;

async function approveExpense(
  budget: BudgetState,
  expenseId: string,
  approver: AID,
  treasury: AssetState
): Promise<{ budget: BudgetState; treasury?: AssetState }>;

async function rejectExpense(
  budget: BudgetState,
  expenseId: string,
  approver: AID,
  reason?: string
): Promise<BudgetState>;

function getBudgetSummary(budget: BudgetState): BudgetSummary;
```

---

## Use Cases

### PTFA School Trip Budget

**Scenario:** Parent-Teacher-Friends Association managing a school trip budget.

**Setup:**
1. PTFA raises £5000 for school trip via fundraising (F4)
2. Trip committee creates budget: £5000 allocation
3. Approvers: Head Teacher, PTFA Chair, Trip Organizer
4. Rules: Require 2/3 approvals, receipts mandatory

**Flow:**
1. Teacher buys coach tickets for £800
   - Submits expense claim with receipt
   - Status: pending
2. Head Teacher and PTFA Chair approve
   - Status: approved (2/3 threshold met)
   - £800 transferred from budget to teacher
3. Parent buys activity materials for £45
   - Under £50 auto-approve limit
   - Delegate bot auto-approves
   - Status: approved & paid immediately
4. Committee reviews budget dashboard
   - Spent: £845
   - Pending: £0
   - Remaining: £4155

### Community Pantry Monthly Budget

**Scenario:** Community group managing monthly food pantry expenses.

**Setup:**
1. Monthly budget: £500 for food purchases
2. Approvers: 2 community organizers
3. Auto-approve: Purchases under £100 from approved stores

**Flow:**
1. Volunteer buys £75 of groceries from approved store
   - Auto-approved by delegate bot
2. Volunteer buys £200 of bulk rice
   - Requires human approval (over £100 limit)
   - 2 organizers approve
3. End of month: Close budget and create new one for next month

---

## UI Requirements (`/budgeting`)

The UI MUST demonstrate:

1. **Budget Dashboard:**
   - List of active budgets
   - Budget cards showing: name, allocated, spent, remaining, status
   - Visual progress bars for spending

2. **Budget Detail View:**
   - Full allocation details
   - List of expenses (pending, approved, rejected)
   - Approver list with approval status
   - Expense submission form

3. **Expense Submission:**
   - Budget selector
   - Amount input
   - Description field
   - Category dropdown (if restricted)
   - Receipt upload/hash input
   - Submit button

4. **Approval Workflow:**
   - Pending expenses list (for approvers)
   - Approve/Reject buttons
   - Approval threshold progress (e.g., "2/3 approvals")
   - Rejection reason input

5. **Budget Analytics:**
   - Spending by category (pie chart)
   - Spending over time (timeline)
   - Top claimants
   - Average expense amount

---

## Testing Strategy

### Golden Snapshot Tests

Every state transition MUST have golden test coverage:

- Budget creation with various rules
- Expense submission (valid and invalid cases)
- Approval workflow (threshold scenarios)
- Rejection workflow
- Auto-approval by delegate bot
- Budget exhaustion
- Concurrent approvals

### Property-Based Tests

- Total spent never exceeds total allocation
- Pending + spent + remaining always equals allocation
- Approval threshold correctly enforced
- Only designated approvers can vote
- Auto-approve only triggers within limits
- Cannot double-spend budget

### Integration Tests with F1 & F2

- Budget allocation reduces treasury asset balance
- Approved expense creates token transfer
- Ledger verification passes after all operations
- Privacy maintained for individual expenses

---

## Governance & Authority

### Budget Creation Authority

**Production Mode:**
- Only AIDs with `budget_authority` credential can create budgets
- Credential specifies:
  - Maximum allocation amount
  - Which treasuries can be used
  - Expiry date

**Demo Mode:**
- `allowAnyoneToCreateBudgets: true` for testing

### Approver Authority

**Production Mode:**
- Approvers must be explicitly listed in budget
- Approvers should have appropriate credentials (e.g., `treasurer_role`, `committee_member`)
- Signatures required on all approvals

**Demo Mode:**
- Anyone can approve for ease of testing

### Delegate Bot Configuration

**Setup:**
```ts
{
  autoApprove: {
    enabled: true,
    limit: "100", // auto-approve under £100
    categories: ["food", "supplies"], // only these categories
    delegateBot: "did:keri:budget_bot_ptfa"
  }
}
```

**Bot Behavior:**
- Bot runs automatically when expense submitted
- Signs approval if all criteria met
- Logs auto-approval with `isAutomatic: true` flag
- Can be audited like any other approval

### Anchoring to Kerits

Each budget operation SHOULD generate a signed event:
```ts
const operation = { type: "expense.approved", ... };
const payload = canonicalize(operation);
const signature = await KeritsAdapter.sign(payload);
// Append to KEL for permanent audit trail
```

### Sync via Merits

Budget updates can be broadcast to committee group:
```ts
await MeritsAdapter.broadcast(
  "ptfa_committee",
  {
    type: "budget.updated",
    budgetId: budget.budgetId,
    operation: newExpense,
    remainingAllocation: getRemainingAllocation(budget)
  }
);
```

Committee members receive updates and can verify:
- Signatures valid
- Approver has authority
- Budget not exceeded
- Accept or challenge update

---

## Success Criteria

Phase F3 is complete when:

1. ✅ `src/ferits/budgeting/core/` exists with deterministic budget and expense logic
2. ✅ `budgeting.schema.ts` defines TypeBox schemas for:
   - Budget state (internal)
   - Expense claims
   - Budget summary (public)
   - Approval/rejection records
3. ✅ Golden snapshot + property tests in `src/ferits/budgeting/test/` pass with deterministic randomness
4. ✅ `/budgeting` route renders working UI with budget dashboard and expense workflow
5. ✅ `/dashboard` card links to `/budgeting` with description: "Transparent budget management with expense approvals"
6. ✅ Governance/authority assumptions documented (who creates budgets, who approves, delegate bot setup)
7. ✅ This document references `guidance.md`

After F3 is complete:
- **F5** can use budgets for mandate-based funding
- **F4** can allocate fundraising proceeds to budgets
- Real-world PTFA and community groups can manage finances transparently

---

## Implementation Checklist

- [ ] Define `BudgetState`, `Expense`, and `BudgetRules` schemas in `budgeting.schema.ts`
- [ ] Implement `createBudget()` function with treasury integration
- [ ] Implement `submitExpense()` with validation
- [ ] Implement `approveExpense()` with threshold checking
- [ ] Implement `rejectExpense()` workflow
- [ ] Add delegate bot auto-approval logic
- [ ] Implement budget summary and analytics helpers
- [ ] Write golden snapshot tests for all state transitions
- [ ] Write property tests for budget invariants
- [ ] Create budget dashboard UI component
- [ ] Create expense submission form
- [ ] Create approval workflow UI
- [ ] Update dashboard with budgeting card
- [ ] Document PTFA use case example
- [ ] Document delegate bot configuration

---

## Next Steps

After F3 completion:
- **F4** allocates fundraising proceeds to budgets
- **F5** uses budgets for governance mandate funding
- **F6** can apply budget constraints to resource permits

Phase F3 provides **transparent group spending** — the accountability foundation for democratic finance.
