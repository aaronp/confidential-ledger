import { describe, it, expect } from "vitest";
import {
  createBudget,
  submitExpense,
  approveExpense,
  rejectExpense,
  closeBudget,
  getUserExpenses,
  getBudgetSummary,
  type CreateBudgetParams,
  type SubmitExpenseParams,
} from "../core/budgeting.api";

describe("Budgeting Module", () => {
  const defaultBudgetParams: CreateBudgetParams = {
    budgetId: "budget_test_001",
    name: "Test Budget",
    description: "Testing budget functionality",
    totalAllocation: "1000",
    approvers: ["approver_alice", "approver_bob"],
    rules: {
      approvalThreshold: 2,
      requireReceipts: false,
      autoApprove: {
        enabled: false,
        limit: "0",
        delegateBot: "",
      },
    },
  };

  describe("Budget Creation", () => {
    it("creates a valid budget with required fields", () => {
      const budget = createBudget(defaultBudgetParams);

      expect(budget.version).toBe("1");
      expect(budget.budgetId).toBe("budget_test_001");
      expect(budget.name).toBe("Test Budget");
      expect(budget.totalAllocation).toBe("1000");
      expect(budget.totalSpent).toBe("0");
      expect(budget.totalPending).toBe("0");
      expect(budget.remaining).toBe("1000");
      expect(budget.status).toBe("active");
      expect(budget.expenses).toHaveLength(0);
      expect(budget.approvers).toEqual(["approver_alice", "approver_bob"]);
    });

    it("rejects negative allocation", () => {
      const params = { ...defaultBudgetParams, totalAllocation: "-100" };
      expect(() => createBudget(params)).toThrow("Budget allocation must be non-negative");
    });

    it("requires at least one approver", () => {
      const params = { ...defaultBudgetParams, approvers: [] };
      expect(() => createBudget(params)).toThrow("Budget must have at least one approver");
    });

    it("validates approval threshold minimum", () => {
      const params = {
        ...defaultBudgetParams,
        rules: { ...defaultBudgetParams.rules, approvalThreshold: 0 },
      };
      expect(() => createBudget(params)).toThrow("Approval threshold must be at least 1");
    });

    it("validates approval threshold does not exceed approvers", () => {
      const params = {
        ...defaultBudgetParams,
        rules: { ...defaultBudgetParams.rules, approvalThreshold: 3 },
      };
      expect(() => createBudget(params)).toThrow(
        "Approval threshold (3) cannot exceed number of approvers (2)"
      );
    });

    it("validates auto-approve settings when enabled", () => {
      const params = {
        ...defaultBudgetParams,
        rules: {
          ...defaultBudgetParams.rules,
          autoApprove: {
            enabled: true,
            limit: "0",
            delegateBot: "",
          },
        },
      };
      expect(() => createBudget(params)).toThrow("Auto-approve limit must be positive");
    });

    it("requires delegate bot for auto-approve", () => {
      const params = {
        ...defaultBudgetParams,
        rules: {
          ...defaultBudgetParams.rules,
          autoApprove: {
            enabled: true,
            limit: "50",
            delegateBot: "",
          },
        },
      };
      expect(() => createBudget(params)).toThrow("Auto-approve requires a delegate bot ID");
    });
  });

  describe("Expense Submission", () => {
    it("submits a valid expense to active budget", () => {
      const budget = createBudget(defaultBudgetParams);
      const expenseParams: SubmitExpenseParams = {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "100",
        description: "Test expense",
      };

      const updated = submitExpense(budget, expenseParams);

      expect(updated.expenses).toHaveLength(1);
      expect(updated.expenses[0].id).toBe("exp_001");
      expect(updated.expenses[0].amount).toBe("100");
      expect(updated.expenses[0].status).toBe("pending");
      expect(updated.totalPending).toBe("100");
      expect(updated.remaining).toBe("900");
    });

    it("rejects expense to closed budget", () => {
      const budget = createBudget(defaultBudgetParams);
      const closed = closeBudget(budget);
      const expenseParams: SubmitExpenseParams = {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "100",
        description: "Test expense",
      };

      expect(() => submitExpense(closed, expenseParams)).toThrow(
        "Cannot submit expense to closed budget"
      );
    });

    it("rejects zero or negative amounts", () => {
      const budget = createBudget(defaultBudgetParams);
      const expenseParams: SubmitExpenseParams = {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "0",
        description: "Test expense",
      };

      expect(() => submitExpense(budget, expenseParams)).toThrow(
        "Expense amount must be positive"
      );
    });

    it("prevents duplicate expense IDs", () => {
      const budget = createBudget(defaultBudgetParams);
      const expenseParams: SubmitExpenseParams = {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "100",
        description: "Test expense",
      };

      const updated = submitExpense(budget, expenseParams);
      expect(() => submitExpense(updated, expenseParams)).toThrow(
        "Expense exp_001 already exists"
      );
    });

    it("enforces receipt requirement when enabled", () => {
      const params = {
        ...defaultBudgetParams,
        rules: { ...defaultBudgetParams.rules, requireReceipts: true },
      };
      const budget = createBudget(params);
      const expenseParams: SubmitExpenseParams = {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "100",
        description: "Test expense",
      };

      expect(() => submitExpense(budget, expenseParams)).toThrow(
        "Receipt is required for this budget"
      );
    });

    it("rejects expense exceeding available budget", () => {
      const budget = createBudget(defaultBudgetParams);
      const expenseParams: SubmitExpenseParams = {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "1500",
        description: "Too large",
      };

      expect(() => submitExpense(budget, expenseParams)).toThrow(
        "would exceed available budget"
      );
    });

    it("accounts for pending expenses when checking budget", () => {
      const budget = createBudget(defaultBudgetParams);
      const expense1 = submitExpense(budget, {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "600",
        description: "First expense",
      });

      const expense2Params: SubmitExpenseParams = {
        expenseId: "exp_002",
        claimant: "user_bob",
        amount: "500",
        description: "Second expense",
      };

      expect(() => submitExpense(expense1, expense2Params)).toThrow(
        "would exceed available budget"
      );
    });
  });

  describe("Auto-Approval", () => {
    it("auto-approves expenses under limit", () => {
      const params = {
        ...defaultBudgetParams,
        rules: {
          ...defaultBudgetParams.rules,
          autoApprove: {
            enabled: true,
            limit: "100",
            delegateBot: "budget_bot",
          },
        },
      };
      const budget = createBudget(params);
      const expenseParams: SubmitExpenseParams = {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "50",
        description: "Small expense",
      };

      const updated = submitExpense(budget, expenseParams);

      expect(updated.expenses[0].status).toBe("approved");
      expect(updated.expenses[0].approvals).toHaveLength(1);
      expect(updated.expenses[0].approvals[0].approver).toBe("budget_bot");
      expect(updated.expenses[0].approvals[0].isAutomatic).toBe(true);
      expect(updated.totalSpent).toBe("50");
      expect(updated.totalPending).toBe("0");
    });

    it("does not auto-approve expenses over limit", () => {
      const params = {
        ...defaultBudgetParams,
        rules: {
          ...defaultBudgetParams.rules,
          autoApprove: {
            enabled: true,
            limit: "100",
            delegateBot: "budget_bot",
          },
        },
      };
      const budget = createBudget(params);
      const expenseParams: SubmitExpenseParams = {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "150",
        description: "Large expense",
      };

      const updated = submitExpense(budget, expenseParams);

      expect(updated.expenses[0].status).toBe("pending");
      expect(updated.expenses[0].approvals).toHaveLength(0);
    });

    it("respects category restrictions for auto-approval", () => {
      const params = {
        ...defaultBudgetParams,
        rules: {
          ...defaultBudgetParams.rules,
          autoApprove: {
            enabled: true,
            limit: "100",
            delegateBot: "budget_bot",
            categories: ["food"],
          },
        },
      };
      const budget = createBudget(params);

      const foodExpense = submitExpense(budget, {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "50",
        description: "Groceries",
        category: "food",
      });

      const travelExpense = submitExpense(foodExpense, {
        expenseId: "exp_002",
        claimant: "user_bob",
        amount: "50",
        description: "Bus tickets",
        category: "travel",
      });

      expect(travelExpense.expenses[0].status).toBe("approved"); // food
      expect(travelExpense.expenses[1].status).toBe("pending"); // travel
    });
  });

  describe("Expense Approval", () => {
    it("records approval from authorized approver", () => {
      const budget = createBudget(defaultBudgetParams);
      const withExpense = submitExpense(budget, {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "100",
        description: "Test",
      });

      const updated = approveExpense(withExpense, "exp_001", "approver_alice");

      expect(updated.expenses[0].approvals).toHaveLength(1);
      expect(updated.expenses[0].approvals[0].approver).toBe("approver_alice");
      expect(updated.expenses[0].status).toBe("pending"); // threshold is 2
    });

    it("approves expense when threshold is met", () => {
      const budget = createBudget(defaultBudgetParams);
      const withExpense = submitExpense(budget, {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "100",
        description: "Test",
      });

      const afterFirst = approveExpense(withExpense, "exp_001", "approver_alice");
      const afterSecond = approveExpense(afterFirst, "exp_001", "approver_bob");

      expect(afterSecond.expenses[0].status).toBe("approved");
      expect(afterSecond.expenses[0].approvals).toHaveLength(2);
      expect(afterSecond.totalSpent).toBe("100");
      expect(afterSecond.totalPending).toBe("0");
      expect(afterSecond.remaining).toBe("900");
    });

    it("rejects approval from unauthorized user", () => {
      const budget = createBudget(defaultBudgetParams);
      const withExpense = submitExpense(budget, {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "100",
        description: "Test",
      });

      expect(() => approveExpense(withExpense, "exp_001", "random_user")).toThrow(
        "random_user is not an authorized approver"
      );
    });

    it("prevents duplicate approvals from same approver", () => {
      const budget = createBudget(defaultBudgetParams);
      const withExpense = submitExpense(budget, {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "100",
        description: "Test",
      });

      const afterFirst = approveExpense(withExpense, "exp_001", "approver_alice");
      expect(() => approveExpense(afterFirst, "exp_001", "approver_alice")).toThrow(
        "approver_alice has already approved this expense"
      );
    });

    it("rejects approval of non-pending expense", () => {
      const budget = createBudget(defaultBudgetParams);
      const withExpense = submitExpense(budget, {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "100",
        description: "Test",
      });

      const rejected = rejectExpense(withExpense, "exp_001", "approver_alice", "Not needed");
      expect(() => approveExpense(rejected, "exp_001", "approver_bob")).toThrow(
        "Cannot approve expense with status: rejected"
      );
    });

    it("handles approval threshold of 1", () => {
      const params = {
        ...defaultBudgetParams,
        approvers: ["approver_alice"],
        rules: { ...defaultBudgetParams.rules, approvalThreshold: 1 },
      };
      const budget = createBudget(params);
      const withExpense = submitExpense(budget, {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "100",
        description: "Test",
      });

      const updated = approveExpense(withExpense, "exp_001", "approver_alice");

      expect(updated.expenses[0].status).toBe("approved");
      expect(updated.totalSpent).toBe("100");
    });
  });

  describe("Expense Rejection", () => {
    it("records rejection from authorized approver", () => {
      const budget = createBudget(defaultBudgetParams);
      const withExpense = submitExpense(budget, {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "100",
        description: "Test",
      });

      const updated = rejectExpense(withExpense, "exp_001", "approver_alice", "Not needed");

      expect(updated.expenses[0].status).toBe("rejected");
      expect(updated.expenses[0].rejections).toHaveLength(1);
      expect(updated.expenses[0].rejections[0].rejector).toBe("approver_alice");
      expect(updated.expenses[0].rejections[0].reason).toBe("Not needed");
      expect(updated.totalPending).toBe("0");
      expect(updated.remaining).toBe("1000");
    });

    it("rejects rejection from unauthorized user", () => {
      const budget = createBudget(defaultBudgetParams);
      const withExpense = submitExpense(budget, {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "100",
        description: "Test",
      });

      expect(() => rejectExpense(withExpense, "exp_001", "random_user")).toThrow(
        "random_user is not an authorized approver"
      );
    });

    it("rejects rejection of non-pending expense", () => {
      const budget = createBudget(defaultBudgetParams);
      const withExpense = submitExpense(budget, {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "100",
        description: "Test",
      });

      const afterFirst = approveExpense(withExpense, "exp_001", "approver_alice");
      const approved = approveExpense(afterFirst, "exp_001", "approver_bob");

      expect(() => rejectExpense(approved, "exp_001", "approver_alice")).toThrow(
        "Cannot reject expense with status: approved"
      );
    });
  });

  describe("Budget Closure", () => {
    it("closes budget with no pending expenses", () => {
      const budget = createBudget(defaultBudgetParams);
      const closed = closeBudget(budget);

      expect(closed.status).toBe("closed");
    });

    it("prevents closing budget with pending expenses", () => {
      const budget = createBudget(defaultBudgetParams);
      const withExpense = submitExpense(budget, {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "100",
        description: "Test",
      });

      expect(() => closeBudget(withExpense)).toThrow(
        "Cannot close budget with pending expenses"
      );
    });

    it("allows closing budget with approved and rejected expenses", () => {
      const budget = createBudget(defaultBudgetParams);
      const withExpense1 = submitExpense(budget, {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "100",
        description: "Approved",
      });
      const withExpense2 = submitExpense(withExpense1, {
        expenseId: "exp_002",
        claimant: "user_bob",
        amount: "50",
        description: "Rejected",
      });

      const approved1 = approveExpense(withExpense2, "exp_001", "approver_alice");
      const approved2 = approveExpense(approved1, "exp_001", "approver_bob");
      const rejected = rejectExpense(approved2, "exp_002", "approver_alice");

      const closed = closeBudget(rejected);
      expect(closed.status).toBe("closed");
    });

    it("prevents double-closing", () => {
      const budget = createBudget(defaultBudgetParams);
      const closed = closeBudget(budget);

      expect(() => closeBudget(closed)).toThrow("Budget is already closed");
    });
  });

  describe("User Expense View", () => {
    it("shows user their own pending expenses", () => {
      const budget = createBudget(defaultBudgetParams);
      const withExpense = submitExpense(budget, {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "100",
        description: "Alice expense",
      });

      const aliceExpenses = getUserExpenses(withExpense, "user_alice");
      expect(aliceExpenses).toHaveLength(1);
      expect(aliceExpenses[0].claimant).toBe("user_alice");
    });

    it("hides other users' pending expenses", () => {
      const budget = createBudget(defaultBudgetParams);
      const withExpense1 = submitExpense(budget, {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "100",
        description: "Alice expense",
      });
      const withExpense2 = submitExpense(withExpense1, {
        expenseId: "exp_002",
        claimant: "user_bob",
        amount: "50",
        description: "Bob expense",
      });

      const aliceExpenses = getUserExpenses(withExpense2, "user_alice");
      expect(aliceExpenses).toHaveLength(1);
      expect(aliceExpenses[0].claimant).toBe("user_alice");
    });

    it("shows approved and rejected expenses to all users", () => {
      const budget = createBudget(defaultBudgetParams);
      const withExpense1 = submitExpense(budget, {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "100",
        description: "Alice expense",
      });
      const withExpense2 = submitExpense(withExpense1, {
        expenseId: "exp_002",
        claimant: "user_bob",
        amount: "50",
        description: "Bob expense",
      });

      const approved1 = approveExpense(withExpense2, "exp_001", "approver_alice");
      const approved2 = approveExpense(approved1, "exp_001", "approver_bob");

      const carolExpenses = getUserExpenses(approved2, "user_carol");
      expect(carolExpenses).toHaveLength(1); // Only the approved one
      expect(carolExpenses[0].id).toBe("exp_001");
    });
  });

  describe("Budget Summary", () => {
    it("calculates summary statistics correctly", () => {
      const budget = createBudget(defaultBudgetParams);
      const withExpense1 = submitExpense(budget, {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "300",
        description: "Expense 1",
      });
      const withExpense2 = submitExpense(withExpense1, {
        expenseId: "exp_002",
        claimant: "user_bob",
        amount: "200",
        description: "Expense 2",
      });

      const approved1 = approveExpense(withExpense2, "exp_001", "approver_alice");
      const approved2 = approveExpense(approved1, "exp_001", "approver_bob");
      const rejected = rejectExpense(approved2, "exp_002", "approver_alice");

      const summary = getBudgetSummary(rejected);

      expect(summary.totalAllocation).toBe(1000n);
      expect(summary.totalSpent).toBe(300n);
      expect(summary.totalPending).toBe(0n);
      expect(summary.remaining).toBe(700n);
      expect(summary.spentPercentage).toBe(30);
      expect(summary.approvedCount).toBe(1);
      expect(summary.pendingCount).toBe(0);
      expect(summary.rejectedCount).toBe(1);
      expect(summary.totalExpenses).toBe(2);
    });

    it("handles zero allocation edge case", () => {
      const params = { ...defaultBudgetParams, totalAllocation: "0" };
      const budget = createBudget(params);
      const summary = getBudgetSummary(budget);

      expect(summary.spentPercentage).toBe(0);
    });
  });

  describe("Complex Workflows", () => {
    it("handles multiple expenses with mixed outcomes", () => {
      const budget = createBudget(defaultBudgetParams);

      // Submit 3 expenses
      const state1 = submitExpense(budget, {
        expenseId: "exp_001",
        claimant: "user_alice",
        amount: "100",
        description: "Will be approved",
      });
      const state2 = submitExpense(state1, {
        expenseId: "exp_002",
        claimant: "user_bob",
        amount: "200",
        description: "Will be rejected",
      });
      const state3 = submitExpense(state2, {
        expenseId: "exp_003",
        claimant: "user_carol",
        amount: "150",
        description: "Will remain pending",
      });

      // Approve exp_001
      const state4 = approveExpense(state3, "exp_001", "approver_alice");
      const state5 = approveExpense(state4, "exp_001", "approver_bob");

      // Reject exp_002
      const state6 = rejectExpense(state5, "exp_002", "approver_alice");

      // Partially approve exp_003
      const final = approveExpense(state6, "exp_003", "approver_alice");

      expect(final.totalSpent).toBe("100");
      expect(final.totalPending).toBe("150");
      expect(final.remaining).toBe("750");

      const summary = getBudgetSummary(final);
      expect(summary.approvedCount).toBe(1);
      expect(summary.pendingCount).toBe(1);
      expect(summary.rejectedCount).toBe(1);
    });
  });
});
