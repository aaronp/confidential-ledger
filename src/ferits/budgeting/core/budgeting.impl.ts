import type { Static } from "@sinclair/typebox";
import type { BudgetState, Expense, BudgetRules } from "./budgeting.schema";

export interface CreateBudgetParams {
  budgetId: string;
  name: string;
  description: string;
  totalAllocation: string; // bigint as string
  approvers: string[]; // AIDs
  rules: Static<typeof BudgetRules>;
}

/**
 * Creates a new budget with the specified allocation and approval rules.
 *
 * @param params - Budget creation parameters
 * @returns A new BudgetState with status "active"
 */
export function createBudget(params: CreateBudgetParams): Static<typeof BudgetState> {
  const { budgetId, name, description, totalAllocation, approvers, rules } = params;

  // Validate allocation is non-negative
  const allocation = BigInt(totalAllocation);
  if (allocation < 0n) {
    throw new Error("Budget allocation must be non-negative");
  }

  // Validate approvers list
  if (approvers.length === 0) {
    throw new Error("Budget must have at least one approver");
  }

  // Validate approval threshold
  if (rules.approvalThreshold < 1) {
    throw new Error("Approval threshold must be at least 1");
  }

  if (rules.approvalThreshold > approvers.length) {
    throw new Error(`Approval threshold (${rules.approvalThreshold}) cannot exceed number of approvers (${approvers.length})`);
  }

  // Validate auto-approve settings
  if (rules.autoApprove?.enabled) {
    const limit = BigInt(rules.autoApprove.limit);
    if (limit <= 0n) {
      throw new Error("Auto-approve limit must be positive");
    }
    if (!rules.autoApprove.delegateBot) {
      throw new Error("Auto-approve requires a delegate bot ID");
    }
  }

  return {
    version: "1",
    budgetId,
    name,
    description,
    totalAllocation,
    totalSpent: "0",
    totalPending: "0",
    remaining: totalAllocation,
    approvers,
    rules,
    expenses: [],
    status: "active",
    createdAt: Date.now(),
  };
}

export interface SubmitExpenseParams {
  expenseId: string;
  claimant: string; // AID
  amount: string; // bigint as string
  description: string;
  category?: string;
  receiptUrl?: string;
}

/**
 * Submits a new expense claim to a budget.
 *
 * @param budget - Current budget state
 * @param params - Expense submission parameters
 * @returns Updated BudgetState with the new expense
 */
export function submitExpense(
  budget: Static<typeof BudgetState>,
  params: SubmitExpenseParams
): Static<typeof BudgetState> {
  const { expenseId, claimant, amount, description, category, receiptUrl } = params;

  // Validate budget status
  if (budget.status !== "active") {
    throw new Error(`Cannot submit expense to ${budget.status} budget`);
  }

  // Validate amount
  const expenseAmount = BigInt(amount);
  if (expenseAmount <= 0n) {
    throw new Error("Expense amount must be positive");
  }

  // Check if expense already exists
  if (budget.expenses.some(e => e.id === expenseId)) {
    throw new Error(`Expense ${expenseId} already exists`);
  }

  // Validate receipt requirement
  if (budget.rules.requireReceipts && !receiptUrl) {
    throw new Error("Receipt is required for this budget");
  }

  // Check if expense would exceed remaining budget
  const remaining = BigInt(budget.remaining);
  const pending = BigInt(budget.totalPending);
  const available = remaining - pending;

  if (expenseAmount > available) {
    throw new Error(
      `Expense amount ${amount} would exceed available budget. ` +
      `Remaining: ${budget.remaining}, Pending: ${budget.totalPending}, Available: ${available.toString()}`
    );
  }

  const now = Date.now();

  // Check for auto-approval
  const autoApprove = budget.rules.autoApprove;
  let status: "pending" | "approved" = "pending";
  let approvals: Array<{ approver: string; timestamp: number; isAutomatic?: boolean }> = [];

  if (
    autoApprove?.enabled &&
    expenseAmount <= BigInt(autoApprove.limit) &&
    (!autoApprove.categories || autoApprove.categories.includes(category || ""))
  ) {
    status = "approved";
    approvals = [
      {
        approver: autoApprove.delegateBot,
        timestamp: now,
        isAutomatic: true,
      },
    ];
  }

  const expense: Static<typeof Expense> = {
    id: expenseId,
    claimant,
    amount,
    description,
    category,
    receiptUrl,
    submittedAt: now,
    status,
    approvals,
    rejections: [],
  };

  // Update totals
  const newTotalPending = status === "pending"
    ? (BigInt(budget.totalPending) + expenseAmount).toString()
    : budget.totalPending;

  const newTotalSpent = status === "approved"
    ? (BigInt(budget.totalSpent) + expenseAmount).toString()
    : budget.totalSpent;

  const newRemaining = (
    BigInt(budget.totalAllocation) - BigInt(newTotalSpent) - BigInt(newTotalPending)
  ).toString();

  return {
    ...budget,
    expenses: [...budget.expenses, expense],
    totalPending: newTotalPending,
    totalSpent: newTotalSpent,
    remaining: newRemaining,
  };
}

/**
 * Records an approval for a pending expense.
 *
 * @param budget - Current budget state
 * @param expenseId - ID of expense to approve
 * @param approver - AID of approver
 * @returns Updated BudgetState with approval recorded
 */
export function approveExpense(
  budget: Static<typeof BudgetState>,
  expenseId: string,
  approver: string
): Static<typeof BudgetState> {
  // Validate approver is authorized
  if (!budget.approvers.includes(approver)) {
    throw new Error(`${approver} is not an authorized approver for this budget`);
  }

  // Find expense
  const expenseIndex = budget.expenses.findIndex(e => e.id === expenseId);
  if (expenseIndex === -1) {
    throw new Error(`Expense ${expenseId} not found`);
  }

  const expense = budget.expenses[expenseIndex];

  // Validate expense status
  if (expense.status !== "pending") {
    throw new Error(`Cannot approve expense with status: ${expense.status}`);
  }

  // Check if approver already approved
  if (expense.approvals.some(a => a.approver === approver)) {
    throw new Error(`${approver} has already approved this expense`);
  }

  const now = Date.now();
  const newApprovals = [
    ...expense.approvals,
    { approver, timestamp: now },
  ];

  // Check if threshold is met
  const thresholdMet = newApprovals.length >= budget.rules.approvalThreshold;
  const newStatus = thresholdMet ? "approved" : "pending";

  const updatedExpense: Static<typeof Expense> = {
    ...expense,
    approvals: newApprovals,
    status: newStatus,
  };

  const updatedExpenses = [...budget.expenses];
  updatedExpenses[expenseIndex] = updatedExpense;

  // Update totals if expense is now approved
  let newTotalPending = budget.totalPending;
  let newTotalSpent = budget.totalSpent;
  let newRemaining = budget.remaining;

  if (thresholdMet) {
    const amount = BigInt(expense.amount);
    newTotalPending = (BigInt(budget.totalPending) - amount).toString();
    newTotalSpent = (BigInt(budget.totalSpent) + amount).toString();
    newRemaining = (BigInt(budget.totalAllocation) - BigInt(newTotalSpent) - BigInt(newTotalPending)).toString();
  }

  return {
    ...budget,
    expenses: updatedExpenses,
    totalPending: newTotalPending,
    totalSpent: newTotalSpent,
    remaining: newRemaining,
  };
}

/**
 * Records a rejection for a pending expense.
 *
 * @param budget - Current budget state
 * @param expenseId - ID of expense to reject
 * @param rejector - AID of rejector
 * @param reason - Optional reason for rejection
 * @returns Updated BudgetState with rejection recorded
 */
export function rejectExpense(
  budget: Static<typeof BudgetState>,
  expenseId: string,
  rejector: string,
  reason?: string
): Static<typeof BudgetState> {
  // Validate rejector is authorized
  if (!budget.approvers.includes(rejector)) {
    throw new Error(`${rejector} is not an authorized approver for this budget`);
  }

  // Find expense
  const expenseIndex = budget.expenses.findIndex(e => e.id === expenseId);
  if (expenseIndex === -1) {
    throw new Error(`Expense ${expenseId} not found`);
  }

  const expense = budget.expenses[expenseIndex];

  // Validate expense status
  if (expense.status !== "pending") {
    throw new Error(`Cannot reject expense with status: ${expense.status}`);
  }

  const now = Date.now();
  const updatedExpense: Static<typeof Expense> = {
    ...expense,
    rejections: [
      ...expense.rejections,
      { rejector, timestamp: now, reason },
    ],
    status: "rejected",
  };

  const updatedExpenses = [...budget.expenses];
  updatedExpenses[expenseIndex] = updatedExpense;

  // Update totals - remove from pending
  const amount = BigInt(expense.amount);
  const newTotalPending = (BigInt(budget.totalPending) - amount).toString();
  const newRemaining = (
    BigInt(budget.totalAllocation) - BigInt(budget.totalSpent) - BigInt(newTotalPending)
  ).toString();

  return {
    ...budget,
    expenses: updatedExpenses,
    totalPending: newTotalPending,
    remaining: newRemaining,
  };
}

/**
 * Closes a budget, preventing further expense submissions.
 *
 * @param budget - Current budget state
 * @returns Updated BudgetState with status "closed"
 */
export function closeBudget(budget: Static<typeof BudgetState>): Static<typeof BudgetState> {
  if (budget.status === "closed") {
    throw new Error("Budget is already closed");
  }

  // Check for pending expenses
  const hasPending = budget.expenses.some(e => e.status === "pending");
  if (hasPending) {
    throw new Error("Cannot close budget with pending expenses");
  }

  return {
    ...budget,
    status: "closed",
  };
}

/**
 * Gets expenses visible to a specific user.
 *
 * @param budget - Current budget state
 * @param userId - AID of user
 * @returns Filtered list of expenses (user's own expenses + all approved/rejected)
 */
export function getUserExpenses(
  budget: Static<typeof BudgetState>,
  userId: string
): Array<Static<typeof Expense>> {
  return budget.expenses.filter(
    e => e.claimant === userId || e.status !== "pending"
  );
}

/**
 * Calculates budget summary statistics.
 */
export function getBudgetSummary(budget: Static<typeof BudgetState>) {
  const allocation = BigInt(budget.totalAllocation);
  const spent = BigInt(budget.totalSpent);
  const pending = BigInt(budget.totalPending);
  const remaining = BigInt(budget.remaining);

  const spentPercentage = allocation > 0n
    ? Number((spent * 100n) / allocation)
    : 0;

  const approvedCount = budget.expenses.filter(e => e.status === "approved").length;
  const pendingCount = budget.expenses.filter(e => e.status === "pending").length;
  const rejectedCount = budget.expenses.filter(e => e.status === "rejected").length;

  return {
    totalAllocation: allocation,
    totalSpent: spent,
    totalPending: pending,
    remaining,
    spentPercentage,
    approvedCount,
    pendingCount,
    rejectedCount,
    totalExpenses: budget.expenses.length,
  };
}
