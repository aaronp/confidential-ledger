/**
 * Public API surface for the budgeting capability.
 *
 * This module exposes the core budgeting operations following the Ferits
 * architecture pattern. All state transitions are pure and deterministic.
 */

export {
  createBudget,
  submitExpense,
  approveExpense,
  rejectExpense,
  closeBudget,
  getUserExpenses,
  getBudgetSummary,
} from "./budgeting.impl";

export type {
  CreateBudgetParams,
  SubmitExpenseParams,
} from "./budgeting.impl";

export * from "./budgeting.schema";
