import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Badge } from "../../../components/ui/badge";
import {
  DollarSign,
  TrendingDown,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Receipt,
  Users
} from "lucide-react";
import {
  createBudget,
  submitExpense,
  approveExpense,
  rejectExpense,
  type BudgetState,
} from "../core/budgeting.api";
import type { Static } from "@sinclair/typebox";

const STORAGE_KEY = "confidential-ledger-budgets";
const CURRENT_USER_KEY = "confidential-ledger-current-user";

// Initialize with sample budgets if none exist
const initializeBudgets = (): Array<Static<typeof BudgetState>> => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error("Failed to load budgets:", e);
    }
  }

  // Create sample budgets
  const budget1 = createBudget({
    budgetId: "budget_trip_2025",
    name: "School Trip 2025",
    description: "Annual school trip to Edinburgh",
    totalAllocation: "5000",
    approvers: ["head_teacher", "ptfa_chair", "trip_organizer"],
    rules: {
      approvalThreshold: 2,
      requireReceipts: true,
      autoApprove: {
        enabled: true,
        limit: "50",
        delegateBot: "budget_bot",
      },
    },
  });

  let state1 = submitExpense(budget1, {
    expenseId: "exp_001",
    claimant: "teacher_alice",
    amount: "800",
    description: "Coach tickets for school trip",
    category: "travel",
    receiptUrl: "https://example.com/receipt1.pdf",
  });
  state1 = approveExpense(state1, "exp_001", "head_teacher");
  state1 = approveExpense(state1, "exp_001", "ptfa_chair");

  state1 = submitExpense(state1, {
    expenseId: "exp_002",
    claimant: "parent_bob",
    amount: "45",
    description: "Activity materials and craft supplies",
    category: "supplies",
    receiptUrl: "https://example.com/receipt2.pdf",
  });

  state1 = submitExpense(state1, {
    expenseId: "exp_003",
    claimant: "teacher_carol",
    amount: "200",
    description: "Museum entry tickets",
    category: "activities",
    receiptUrl: "https://example.com/receipt3.pdf",
  });
  state1 = approveExpense(state1, "exp_003", "head_teacher");

  const budget2 = createBudget({
    budgetId: "budget_pantry_jan",
    name: "Community Pantry January",
    description: "Monthly food pantry operations",
    totalAllocation: "500",
    approvers: ["organizer_alice", "organizer_bob"],
    rules: {
      approvalThreshold: 1,
      requireReceipts: false,
      autoApprove: {
        enabled: true,
        limit: "100",
        delegateBot: "budget_bot",
        categories: ["food"],
      },
    },
  });

  let state2 = submitExpense(budget2, {
    expenseId: "exp_004",
    claimant: "volunteer_dan",
    amount: "180",
    description: "Weekly grocery restock",
    category: "food",
  });

  state2 = submitExpense(state2, {
    expenseId: "exp_005",
    claimant: "volunteer_eve",
    amount: "140",
    description: "Fresh produce from local market",
    category: "food",
  });

  return [state1, state2];
};

// Mock data for demonstration - keeping structure for reference
const mockBudgets_old = [
  {
    budgetId: "budget_trip_2025",
    name: "School Trip 2025",
    description: "Annual school trip to Edinburgh",
    totalAllocation: "5000",
    totalSpent: "845",
    totalPending: "200",
    remaining: "3955",
    status: "active" as const,
    expenses: [
      {
        id: "exp_001",
        claimant: "teacher_alice",
        amount: "800",
        description: "Coach tickets for school trip",
        category: "travel",
        submittedAt: Date.now() - 86400000,
        status: "approved" as const,
        approvals: [
          { approver: "head_teacher", timestamp: Date.now() - 80000000 },
          { approver: "ptfa_chair", timestamp: Date.now() - 79000000 },
        ],
        rejections: [],
      },
      {
        id: "exp_002",
        claimant: "parent_bob",
        amount: "45",
        description: "Activity materials and craft supplies",
        category: "supplies",
        submittedAt: Date.now() - 43200000,
        status: "approved" as const,
        approvals: [
          { approver: "budget_bot", timestamp: Date.now() - 43000000, isAutomatic: true },
        ],
        rejections: [],
      },
      {
        id: "exp_003",
        claimant: "teacher_carol",
        amount: "200",
        description: "Museum entry tickets",
        category: "activities",
        submittedAt: Date.now() - 3600000,
        status: "pending" as const,
        approvals: [
          { approver: "head_teacher", timestamp: Date.now() - 1800000 },
        ],
        rejections: [],
      },
    ],
    approvers: ["head_teacher", "ptfa_chair", "trip_organizer"],
    rules: {
      approvalThreshold: 2,
      requireReceipts: true,
      autoApprove: {
        enabled: true,
        limit: "50",
        delegateBot: "budget_bot",
      },
    },
  },
  {
    budgetId: "budget_pantry_jan",
    name: "Community Pantry January",
    description: "Monthly food pantry operations",
    totalAllocation: "500",
    totalSpent: "320",
    totalPending: "0",
    remaining: "180",
    status: "active" as const,
    expenses: [],
    approvers: ["organizer_alice", "organizer_bob"],
    rules: {
      approvalThreshold: 1,
      requireReceipts: false,
      autoApprove: {
        enabled: true,
        limit: "100",
        categories: ["food"],
        delegateBot: "budget_bot",
      },
    },
  },
];

export function BudgetingPage() {
  const [budgets, setBudgets] = useState<Array<Static<typeof BudgetState>>>([]);
  const [selectedBudget, setSelectedBudget] = useState<Static<typeof BudgetState> | null>(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [currentUser, setCurrentUser] = useState<string>("head_teacher");

  // Form state
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("");
  const [expenseReceipt, setExpenseReceipt] = useState("");

  useEffect(() => {
    const loaded = initializeBudgets();
    setBudgets(loaded);
    if (loaded.length > 0) {
      setSelectedBudget(loaded[0]);
    }

    const storedUser = localStorage.getItem(CURRENT_USER_KEY);
    if (storedUser) {
      setCurrentUser(storedUser);
    }
  }, []);

  const saveBudgets = (newBudgets: Array<Static<typeof BudgetState>>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newBudgets));
    setBudgets(newBudgets);

    // Update selected budget if it changed
    if (selectedBudget) {
      const updated = newBudgets.find(b => b.budgetId === selectedBudget.budgetId);
      if (updated) {
        setSelectedBudget(updated);
      }
    }
  };

  const handleSubmitExpense = () => {
    if (!selectedBudget || !expenseAmount || !expenseDescription) return;

    try {
      const expenseId = `exp_${Date.now()}`;
      const updated = submitExpense(selectedBudget, {
        expenseId,
        claimant: currentUser,
        amount: expenseAmount,
        description: expenseDescription,
        category: expenseCategory || undefined,
        receiptUrl: expenseReceipt || undefined,
      });

      const newBudgets = budgets.map(b =>
        b.budgetId === selectedBudget.budgetId ? updated : b
      );
      saveBudgets(newBudgets);

      // Reset form
      setExpenseAmount("");
      setExpenseDescription("");
      setExpenseCategory("");
      setExpenseReceipt("");
      setShowExpenseForm(false);
    } catch (error) {
      alert(`Failed to submit expense: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleApprove = (expenseId: string) => {
    if (!selectedBudget) return;

    try {
      const updated = approveExpense(selectedBudget, expenseId, currentUser);
      const newBudgets = budgets.map(b =>
        b.budgetId === selectedBudget.budgetId ? updated : b
      );
      saveBudgets(newBudgets);
    } catch (error) {
      alert(`Failed to approve: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleReject = (expenseId: string) => {
    if (!selectedBudget) return;

    const reason = prompt("Reason for rejection (optional):");
    if (reason === null) return; // User cancelled

    try {
      const updated = rejectExpense(selectedBudget, expenseId, currentUser, reason || undefined);
      const newBudgets = budgets.map(b =>
        b.budgetId === selectedBudget.budgetId ? updated : b
      );
      saveBudgets(newBudgets);
    } catch (error) {
      alert(`Failed to reject: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const getSpentPercentage = (spent: string, total: string) => {
    return Math.round((Number(spent) / Number(total)) * 100);
  };

  const formatCurrency = (amount: string) => {
    return `£${Number(amount).toLocaleString()}`;
  };

  if (budgets.length === 0) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <p className="text-muted-foreground">Loading budgets...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            Budget Management
          </h1>
          <p className="text-muted-foreground">
            Transparent spending with multi-party approval
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">Acting as:</span>
            <select
              value={currentUser}
              onChange={(e) => {
                setCurrentUser(e.target.value);
                localStorage.setItem(CURRENT_USER_KEY, e.target.value);
              }}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="head_teacher">head_teacher</option>
              <option value="ptfa_chair">ptfa_chair</option>
              <option value="trip_organizer">trip_organizer</option>
              <option value="organizer_alice">organizer_alice</option>
              <option value="organizer_bob">organizer_bob</option>
              <option value="teacher_alice">teacher_alice</option>
              <option value="parent_bob">parent_bob</option>
              <option value="volunteer_dan">volunteer_dan</option>
            </select>
          </div>
        </header>

        {/* Budget Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((budget) => (
            <Card
              key={budget.budgetId}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedBudget?.budgetId === budget.budgetId
                  ? "border-primary ring-2 ring-primary"
                  : ""
              }`}
              onClick={() => setSelectedBudget(budget)}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{budget.name}</span>
                  <Badge variant={budget.status === "active" ? "default" : "secondary"}>
                    {budget.status}
                  </Badge>
                </CardTitle>
                <CardDescription>{budget.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Allocated</span>
                    <span className="font-semibold">{formatCurrency(budget.totalAllocation)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <TrendingDown className="w-3 h-3" /> Spent
                    </span>
                    <span className="font-semibold text-red-600">
                      {formatCurrency(budget.totalSpent)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Pending
                    </span>
                    <span className="font-semibold text-orange-600">
                      {formatCurrency(budget.totalPending)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Remaining
                    </span>
                    <span className="font-semibold text-green-600">
                      {formatCurrency(budget.remaining)}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="pt-2">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Spent</span>
                      <span>{getSpentPercentage(budget.totalSpent, budget.totalAllocation)}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{
                          width: `${getSpentPercentage(budget.totalSpent, budget.totalAllocation)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Selected Budget Details */}
        {selectedBudget && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Expenses List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="w-5 h-5" />
                      Expenses
                    </CardTitle>
                    <Button size="sm" onClick={() => setShowExpenseForm(!showExpenseForm)}>
                      <Plus className="w-4 h-4 mr-1" />
                      Submit Expense
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {showExpenseForm && (
                    <div className="mb-6 p-4 border rounded-lg bg-muted/50">
                      <h4 className="font-semibold mb-3">Submit New Expense</h4>
                      <div className="space-y-3">
                        <Input
                          placeholder="Amount"
                          type="number"
                          value={expenseAmount}
                          onChange={(e) => setExpenseAmount(e.target.value)}
                        />
                        <Input
                          placeholder="Description"
                          value={expenseDescription}
                          onChange={(e) => setExpenseDescription(e.target.value)}
                        />
                        <Input
                          placeholder="Category (optional)"
                          value={expenseCategory}
                          onChange={(e) => setExpenseCategory(e.target.value)}
                        />
                        <Input
                          placeholder="Receipt URL (optional)"
                          value={expenseReceipt}
                          onChange={(e) => setExpenseReceipt(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleSubmitExpense}>
                            Submit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowExpenseForm(false)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {selectedBudget.expenses.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No expenses yet
                      </p>
                    ) : (
                      selectedBudget.expenses.map((expense) => (
                        <div
                          key={expense.id}
                          className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold">
                                  {formatCurrency(expense.amount)}
                                </span>
                                {expense.category && (
                                  <Badge variant="outline" className="text-xs">
                                    {expense.category}
                                  </Badge>
                                )}
                                {expense.status === "approved" && (
                                  <Badge variant="default" className="text-xs">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Approved
                                  </Badge>
                                )}
                                {expense.status === "pending" && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Pending
                                  </Badge>
                                )}
                                {expense.status === "rejected" && (
                                  <Badge variant="destructive" className="text-xs">
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Rejected
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {expense.description}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                By {expense.claimant} •{" "}
                                {new Date(expense.submittedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          {/* Approval Status */}
                          {expense.status === "pending" && (
                            <div className="mt-3 pt-3 border-t">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  Approvals: {expense.approvals.length} /{" "}
                                  {selectedBudget.rules.approvalThreshold}
                                </span>
                                {selectedBudget.approvers.includes(currentUser) && (
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="default"
                                      onClick={() => handleApprove(expense.id)}
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleReject(expense.id)}
                                    >
                                      Reject
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {expense.approvals.length > 0 && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              {expense.approvals.map((approval, idx) => (
                                <div key={idx} className="flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-green-600" />
                                  {approval.approver}
                                  {approval.isAutomatic && " (auto)"}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Budget Info Sidebar */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Budget Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <div className="mt-1">
                      <Badge>{selectedBudget.status}</Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Allocated:</span>
                    <div className="text-lg font-bold mt-1">
                      {formatCurrency(selectedBudget.totalAllocation)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Spent:</span>
                    <div className="text-lg font-bold text-red-600 mt-1">
                      {formatCurrency(selectedBudget.totalSpent)}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Remaining:</span>
                    <div className="text-lg font-bold text-green-600 mt-1">
                      {formatCurrency(selectedBudget.remaining)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Approvers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {selectedBudget.approvers.map((approver) => (
                      <div key={approver} className="flex items-center gap-2 text-sm">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="w-3 h-3" />
                        </div>
                        <span>{approver}</span>
                      </div>
                    ))}
                    <div className="pt-2 mt-2 border-t text-xs text-muted-foreground">
                      Requires {selectedBudget.rules.approvalThreshold} approval
                      {selectedBudget.rules.approvalThreshold > 1 ? "s" : ""}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Auto-Approval</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  {selectedBudget.rules.autoApprove?.enabled ? (
                    <>
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="text-xs">
                          Enabled
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">
                        Expenses under {formatCurrency(selectedBudget.rules.autoApprove.limit)}{" "}
                        auto-approve
                      </p>
                      {selectedBudget.rules.autoApprove.categories && (
                        <p className="text-xs text-muted-foreground">
                          Categories: {selectedBudget.rules.autoApprove.categories.join(", ")}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground">Disabled</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
