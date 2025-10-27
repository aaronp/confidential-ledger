import { Type, type Static } from "@sinclair/typebox";

/**
 * Budget Rules Schema
 * Defines approval and spending rules for a budget.
 *
 * Visibility: Internal configuration (visible to budget managers).
 */
export const AutoApproveConfig = Type.Object(
  {
    enabled: Type.Boolean({
      description: "Whether automatic approval is enabled",
      examples: [true, false],
    }),
    limit: Type.String({
      description:
        "Auto-approve expenses under this amount (base-10 stringified bigint)",
      examples: ["100", "50", "250"],
    }),
    categories: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "If specified, only auto-approve expenses in these categories",
        examples: [["food", "supplies"], ["travel"]],
      })
    ),
    delegateBot: Type.String({
      description: "AID of the bot that signs auto-approvals",
      examples: ["did:keri:budget_bot", "bot_auto_approver"],
    }),
  },
  {
    $id: "ferits/budgeting/AutoApproveConfig",
    description: "Configuration for automatic expense approval",
  }
);

export type AutoApproveConfig = Static<typeof AutoApproveConfig>;

export const BudgetRules = Type.Object(
  {
    approvalThreshold: Type.Number({
      description:
        "Number of approvals required (e.g., 2 means 2 out of N approvers must approve)",
      examples: [1, 2, 3],
      minimum: 1,
    }),
    requireReceipts: Type.Boolean({
      description: "Whether receipts are mandatory for expense claims",
      examples: [true, false],
    }),
    autoApprove: Type.Optional(AutoApproveConfig),
    allowedCategories: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "If specified, only expenses in these categories are allowed",
        examples: [["food", "travel", "supplies"], ["equipment"]],
      })
    ),
    maxExpenseAmount: Type.Optional(
      Type.String({
        description:
          "Maximum amount for a single expense (base-10 stringified bigint)",
        examples: ["1000", "500"],
      })
    ),
  },
  {
    $id: "ferits/budgeting/BudgetRules",
    description: "Approval and spending rules for a budget",
  }
);

export type BudgetRules = Static<typeof BudgetRules>;

/**
 * Approval Schema
 * Records a single approval vote on an expense.
 *
 * Visibility: Public within budget context.
 */
export const Approval = Type.Object(
  {
    approver: Type.String({
      description: "AID of the approver",
      examples: ["did:keri:treasurer_alice", "did:keri:chair_bob"],
    }),
    timestamp: Type.Number({
      description: "Unix timestamp (milliseconds) of approval",
      examples: [1735689600000, 1738368000000],
    }),
    signature: Type.Optional(
      Type.Any({
        description:
          "Cryptographic signature (Uint8Array in runtime) proving approval",
      })
    ),
    isAutomatic: Type.Optional(
      Type.Boolean({
        description: "True if this was an automatic approval by delegate bot",
        examples: [false, true],
      })
    ),
  },
  {
    $id: "ferits/budgeting/Approval",
    description: "Record of a single approval vote",
  }
);

export type Approval = Static<typeof Approval>;

/**
 * Rejection Schema
 * Records a single rejection vote on an expense.
 *
 * Visibility: Public within budget context.
 */
export const Rejection = Type.Object(
  {
    approver: Type.String({
      description: "AID of the rejector",
    }),
    timestamp: Type.Number({
      description: "Unix timestamp (milliseconds) of rejection",
    }),
    reason: Type.Optional(
      Type.String({
        description: "Optional reason for rejection",
        examples: ["Insufficient documentation", "Out of scope", "Duplicate claim"],
      })
    ),
    signature: Type.Optional(
      Type.Any({
        description: "Cryptographic signature proving rejection",
      })
    ),
  },
  {
    $id: "ferits/budgeting/Rejection",
    description: "Record of a single rejection vote",
  }
);

export type Rejection = Static<typeof Rejection>;

/**
 * Expense Schema
 * Represents a single expense claim against a budget.
 *
 * Visibility: Private to claimant and approvers (can be made public after approval).
 */
export const Expense = Type.Object(
  {
    id: Type.String({
      description: "Unique expense identifier",
      examples: ["exp_2025_001", "claim_abc123"],
    }),
    budgetId: Type.String({
      description: "ID of the budget this expense is charged to",
    }),
    claimant: Type.String({
      description: "AID of the person requesting reimbursement",
      examples: ["did:keri:alice", "teacher_bob"],
    }),
    amount: Type.String({
      description: "Amount to reimburse (base-10 stringified bigint)",
      examples: ["100", "850", "45"],
    }),
    description: Type.String({
      description: "Description of what was purchased",
      examples: [
        "Coach tickets for school trip",
        "Activity materials",
        "Food for community pantry",
      ],
    }),
    category: Type.Optional(
      Type.String({
        description: "Category of expense",
        examples: ["food", "travel", "supplies", "equipment"],
      })
    ),
    receipts: Type.Optional(
      Type.Array(Type.String(), {
        description: "URLs or hashes of receipt images/documents",
        examples: [["https://receipts.example.com/123.pdf"], ["ipfs://Qm..."]],
      })
    ),
    submittedAt: Type.Number({
      description: "Unix timestamp when expense was submitted",
    }),
    status: Type.Union(
      [
        Type.Literal("pending"),
        Type.Literal("approved"),
        Type.Literal("rejected"),
        Type.Literal("paid"),
      ],
      {
        description:
          "Status: pending (awaiting approval), approved (ready to pay), rejected (denied), paid (reimbursed)",
      }
    ),
    approvals: Type.Array(Approval, {
      description: "List of approvals received",
    }),
    rejections: Type.Array(Rejection, {
      description: "List of rejections received",
    }),
    paidAt: Type.Optional(
      Type.Number({
        description: "Unix timestamp when payment was made",
      })
    ),
    transactionId: Type.Optional(
      Type.String({
        description:
          "Transaction ID from the payment (operation ID from F2 transfer)",
      })
    ),
  },
  {
    $id: "ferits/budgeting/Expense",
    description: "A single expense claim against a budget",
  }
);

export type Expense = Static<typeof Expense>;

/**
 * Budget State Schema
 * Complete state of a budget including all expenses.
 *
 * Visibility: Internal state (managers see all; participants see filtered views).
 */
export const BudgetState = Type.Object(
  {
    version: Type.String({
      description: "Budget state schema version",
      examples: ["1"],
      pattern: "^[0-9]+$",
    }),
    budgetId: Type.String({
      description: "Unique budget identifier",
      examples: ["budget_school_trip_2025", "pantry_jan_2025"],
    }),
    name: Type.String({
      description: "Human-readable budget name",
      examples: ["School Trip 2025", "Community Pantry January"],
    }),
    description: Type.String({
      description: "Purpose and scope of the budget",
      examples: [
        "Annual school trip to Edinburgh",
        "Monthly food pantry operations",
      ],
    }),
    totalAllocation: Type.String({
      description:
        "Total amount allocated to this budget (base-10 stringified bigint)",
      examples: ["5000", "500", "10000"],
    }),
    approvers: Type.Array(Type.String(), {
      description: "List of AIDs authorized to approve expenses",
      examples: [
        ["did:keri:head_teacher", "did:keri:ptfa_chair", "did:keri:organizer"],
      ],
    }),
    rules: BudgetRules,
    expenses: Type.Array(Expense, {
      description: "All expense claims against this budget",
    }),
    status: Type.Union(
      [
        Type.Literal("active"),
        Type.Literal("closed"),
        Type.Literal("exhausted"),
      ],
      {
        description:
          "Status: active (accepting expenses), closed (manually ended), exhausted (no funds remaining)",
      }
    ),
    createdAt: Type.Number({
      description: "Unix timestamp when budget was created",
    }),
    createdBy: Type.String({
      description: "AID of the person who created this budget",
    }),
    closedAt: Type.Optional(
      Type.Number({
        description: "Unix timestamp when budget was closed",
      })
    ),
    closedReason: Type.Optional(
      Type.String({
        description: "Reason for closing budget",
      })
    ),
  },
  {
    $id: "ferits/budgeting/BudgetState",
    description: "Complete state of a budget with all expenses",
  }
);

export type BudgetState = Static<typeof BudgetState>;

/**
 * Budget Summary Schema
 * High-level overview of a budget's status.
 *
 * Visibility: Public (anyone can see aggregate numbers).
 */
export const BudgetSummary = Type.Object(
  {
    budgetId: Type.String({
      description: "Budget identifier",
    }),
    name: Type.String({
      description: "Budget name",
    }),
    totalAllocation: Type.String({
      description: "Total allocated amount",
    }),
    totalSpent: Type.String({
      description: "Total of approved expenses",
    }),
    totalPending: Type.String({
      description: "Total of pending expenses",
    }),
    remaining: Type.String({
      description: "Remaining available amount",
    }),
    expenseCount: Type.Object({
      pending: Type.Number({ description: "Number of pending expenses" }),
      approved: Type.Number({ description: "Number of approved expenses" }),
      rejected: Type.Number({ description: "Number of rejected expenses" }),
      paid: Type.Number({ description: "Number of paid expenses" }),
    }),
    status: Type.Union([
      Type.Literal("active"),
      Type.Literal("closed"),
      Type.Literal("exhausted"),
    ]),
  },
  {
    $id: "ferits/budgeting/BudgetSummary",
    description: "High-level overview of budget status",
  }
);

export type BudgetSummary = Static<typeof BudgetSummary>;

/**
 * Expense Submission Schema
 * User input for submitting a new expense claim.
 *
 * Visibility: Private between claimant and system.
 */
export const ExpenseSubmission = Type.Object(
  {
    budgetId: Type.String({
      description: "Which budget to charge",
    }),
    amount: Type.Number({
      description: "Amount to reimburse",
      minimum: 1,
    }),
    description: Type.String({
      description: "What was purchased",
      minLength: 10,
    }),
    category: Type.Optional(
      Type.String({
        description: "Expense category",
      })
    ),
    receipts: Type.Optional(
      Type.Array(Type.String(), {
        description: "Receipt URLs or hashes",
      })
    ),
  },
  {
    $id: "ferits/budgeting/ExpenseSubmission",
    description: "User input for submitting expense claim",
  }
);

export type ExpenseSubmission = Static<typeof ExpenseSubmission>;
