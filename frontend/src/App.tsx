import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";

const API_URL = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

type TransactionType = "income" | "expense";
type RecurringFrequency = "weekly" | "biweekly" | "monthly" | "yearly";
type DateFilter = "all" | "current" | "previous" | "custom";

interface Transaction {
  id: number;
  description: string;
  amount: number;
  category: string;
  transaction_type: TransactionType;
  transaction_date: string;
}

interface TransactionForm {
  description: string;
  amount: string;
  category: string;
  transaction_type: TransactionType;
  transaction_date: string;
}

interface AiInsightResponse {
  insight: string;
}

interface RecurringTransaction {
  id: number;
  description: string;
  amount: number;
  category: string;
  transaction_type: TransactionType;
  frequency: RecurringFrequency;
  next_due_date: string;
  is_active: boolean;
}

interface RecurringTransactionForm {
  description: string;
  amount: string;
  category: string;
  transaction_type: TransactionType;
  frequency: RecurringFrequency;
  next_due_date: string;
}

interface CashFlowForecast {
  current_balance: number;
  projected_monthly_income: number;
  projected_monthly_expenses: number;
  projected_net_cash_flow: number;
  projected_ending_balance: number;
  active_recurring_transactions: number;
}

interface Budget {
  id: number;
  category: string;
  monthly_limit: number;
}

interface BudgetForm {
  category: string;
  monthly_limit: string;
}

interface SavingsGoal {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
}

interface SavingsGoalForm {
  name: string;
  target_amount: string;
  current_amount: string;
  target_date: string;
}

const emptyForm: TransactionForm = {
  description: "",
  amount: "",
  category: "",
  transaction_type: "expense",
  transaction_date: new Date().toISOString().split("T")[0],
};

const emptyRecurringForm: RecurringTransactionForm = {
  description: "",
  amount: "",
  category: "",
  transaction_type: "expense",
  frequency: "monthly",
  next_due_date: new Date().toISOString().split("T")[0],
};

const emptyBudgetForm: BudgetForm = {
  category: "",
  monthly_limit: "",
};

const emptySavingsGoalForm: SavingsGoalForm = {
  name: "",
  target_amount: "",
  current_amount: "0",
  target_date: "",
};

const expenseCategories = [
  "Housing",
  "Groceries",
  "Dining",
  "Gas",
  "Vehicle Maintenance",
  "Utilities",
  "Internet",
  "Cell Phone",
  "Subscriptions",
  "Insurance",
  "Healthcare",
  "Education",
  "Entertainment",
  "Shopping",
  "Gift",
  "Travel",
  "Child Support",
  "Credit Card Payment",
  "Tax Bill",
  "Personal Care",
  "Other",
];

const incomeCategories = [
  "Salary",
  "Rideshare",
  "Freelance",
  "Bonus",
  "Refund",
  "Investment Income",
  "Other Income",
];

function escapeCsvValue(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsvRow(row: string) {
  const values: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];

    if (character === '"') {
      if (inQuotes && row[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === "," && !inQuotes) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }

  values.push(value.trim());
  return values;
}

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [form, setForm] = useState<TransactionForm>(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [aiInsight, setAiInsight] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  const [recurringTransactions, setRecurringTransactions] = useState<
    RecurringTransaction[]
  >([]);
  const [recurringForm, setRecurringForm] =
    useState<RecurringTransactionForm>(emptyRecurringForm);
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [recurringError, setRecurringError] = useState("");
  const [forecast, setForecast] = useState<CashFlowForecast | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [budgetForm, setBudgetForm] = useState<BudgetForm>(emptyBudgetForm);
  const [budgetEditingId, setBudgetEditingId] = useState<number | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetError, setBudgetError] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [savingsGoalForm, setSavingsGoalForm] =
    useState<SavingsGoalForm>(emptySavingsGoalForm);
  const [savingsGoalEditingId, setSavingsGoalEditingId] = useState<
    number | null
  >(null);
  const [contributionAmounts, setContributionAmounts] = useState<
    Record<number, string>
  >({});
  const [savingsGoalLoading, setSavingsGoalLoading] = useState(false);
  const [savingsGoalError, setSavingsGoalError] = useState("");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<
    "all" | TransactionType
  >("all");
  const [transactionCategoryFilter, setTransactionCategoryFilter] =
    useState("all");
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvMessage, setCsvMessage] = useState("");
  const [csvError, setCsvError] = useState("");

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(
    now.getMonth() + 1,
  ).padStart(2, "0")}`;
  const previousMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthKey = `${previousMonthDate.getFullYear()}-${String(
    previousMonthDate.getMonth() + 1,
  ).padStart(2, "0")}`;

  const filteredTransactions = transactions.filter((transaction) => {
    if (dateFilter === "current") {
      return transaction.transaction_date.startsWith(currentMonthKey);
    }

    if (dateFilter === "previous") {
      return transaction.transaction_date.startsWith(previousMonthKey);
    }

    if (dateFilter === "custom") {
      const afterStart =
        !customStartDate || transaction.transaction_date >= customStartDate;
      const beforeEnd =
        !customEndDate || transaction.transaction_date <= customEndDate;
      return afterStart && beforeEnd;
    }

    return true;
  });

  const visibleTransactions = filteredTransactions.filter((transaction) => {
    const searchTerm = transactionSearch.trim().toLowerCase();
    const matchesSearch =
      !searchTerm ||
      transaction.description.toLowerCase().includes(searchTerm) ||
      transaction.category.toLowerCase().includes(searchTerm);
    const matchesType =
      transactionTypeFilter === "all" ||
      transaction.transaction_type === transactionTypeFilter;
    const matchesCategory =
      transactionCategoryFilter === "all" ||
      transaction.category === transactionCategoryFilter;

    return matchesSearch && matchesType && matchesCategory;
  });

  const availableTransactionCategories = Array.from(
    new Set(filteredTransactions.map((transaction) => transaction.category)),
  ).sort();

  const totalIncome = filteredTransactions
    .filter((transaction) => transaction.transaction_type === "income")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const totalExpenses = filteredTransactions
    .filter((transaction) => transaction.transaction_type === "expense")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const balance = totalIncome - totalExpenses;

  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentMonthSpending = transactions
    .filter(
      (transaction) =>
        transaction.transaction_type === "expense" &&
        transaction.transaction_date.startsWith(currentMonth),
    )
    .reduce<Record<string, number>>((totals, transaction) => {
      totals[transaction.category] =
        (totals[transaction.category] || 0) + transaction.amount;
      return totals;
    }, {});

  const spendingByCategory = filteredTransactions
    .filter((transaction) => transaction.transaction_type === "expense")
    .reduce<Record<string, number>>((totals, transaction) => {
      totals[transaction.category] =
        (totals[transaction.category] || 0) + transaction.amount;

      return totals;
    }, {});

  const chartData = Object.entries(spendingByCategory).map(([name, value]) => ({
    name,
    value,
  }));

  const chartColors = [
    "#60a5fa",
    "#34d399",
    "#fbbf24",
    "#f87171",
    "#a78bfa",
    "#22d3ee",
    "#fb7185",
    "#4ade80",
    "#f59e0b",
    "#818cf8",
  ];

  const monthlySpending = filteredTransactions
    .filter((transaction) => transaction.transaction_type === "expense")
    .reduce<Record<string, number>>((totals, transaction) => {
      const month = transaction.transaction_date.slice(0, 7);

      totals[month] = (totals[month] || 0) + transaction.amount;

      return totals;
    }, {});

  const monthlyChartData = Object.entries(monthlySpending)
    .sort(([monthA], [monthB]) => monthA.localeCompare(monthB))
    .map(([month, amount]) => {
      const [year, monthNumber] = month.split("-");

      const monthLabel = new Date(
        Number(year),
        Number(monthNumber) - 1,
      ).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      });

      return {
        month: monthLabel,
        amount,
      };
    });

  async function loadTransactions() {
    try {
      const response = await fetch(`${API_URL}/transactions`);

      if (!response.ok) {
        throw new Error("Unable to load transactions.");
      }

      const data: Transaction[] = await response.json();
      setTransactions(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load transactions.",
      );
    }
  }

  async function loadRecurringTransactions() {
    try {
      const response = await fetch(`${API_URL}/recurring-transactions`);

      if (!response.ok) {
        throw new Error("Unable to load recurring transactions.");
      }

      const data: RecurringTransaction[] = await response.json();
      setRecurringTransactions(data);
    } catch (err) {
      setRecurringError(
        err instanceof Error
          ? err.message
          : "Unable to load recurring transactions.",
      );
    }
  }

  async function loadForecast() {
    try {
      const response = await fetch(`${API_URL}/cash-flow/forecast`);

      if (!response.ok) {
        throw new Error("Unable to load cash-flow forecast.");
      }

      const data: CashFlowForecast = await response.json();
      setForecast(data);
    } catch (err) {
      setRecurringError(
        err instanceof Error
          ? err.message
          : "Unable to load cash-flow forecast.",
      );
    }
  }

  async function loadBudgets() {
    try {
      const response = await fetch(`${API_URL}/budgets`);

      if (!response.ok) {
        throw new Error("Unable to load budgets.");
      }

      const data: Budget[] = await response.json();
      setBudgets(data);
    } catch (err) {
      setBudgetError(
        err instanceof Error ? err.message : "Unable to load budgets.",
      );
    }
  }

  async function loadSavingsGoals() {
    try {
      const response = await fetch(`${API_URL}/savings-goals`);

      if (!response.ok) {
        throw new Error("Unable to load savings goals.");
      }

      const data: SavingsGoal[] = await response.json();
      setSavingsGoals(data);
    } catch (err) {
      setSavingsGoalError(
        err instanceof Error ? err.message : "Unable to load savings goals.",
      );
    }
  }

  useEffect(() => {
    loadTransactions();
    loadRecurringTransactions();
    loadForecast();
    loadBudgets();
    loadSavingsGoals();
  }, []);

  async function saveSavingsGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingsGoalError("");

    const targetAmount = Number(savingsGoalForm.target_amount);
    const currentAmount = Number(savingsGoalForm.current_amount || 0);

    if (!savingsGoalForm.name || !savingsGoalForm.target_amount) {
      setSavingsGoalError("Enter a goal name and target amount.");
      return;
    }

    if (
      Number.isNaN(targetAmount) ||
      targetAmount <= 0 ||
      Number.isNaN(currentAmount) ||
      currentAmount < 0 ||
      currentAmount > targetAmount
    ) {
      setSavingsGoalError(
        "Use valid amounts, and keep the saved amount at or below the target.",
      );
      return;
    }

    setSavingsGoalLoading(true);

    try {
      const url =
        savingsGoalEditingId === null
          ? `${API_URL}/savings-goals`
          : `${API_URL}/savings-goals/${savingsGoalEditingId}`;
      const response = await fetch(url, {
        method: savingsGoalEditingId === null ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: savingsGoalForm.name,
          target_amount: targetAmount,
          current_amount: currentAmount,
          target_date: savingsGoalForm.target_date || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail || "Unable to save savings goal.");
      }

      setSavingsGoalForm(emptySavingsGoalForm);
      setSavingsGoalEditingId(null);
      await loadSavingsGoals();
    } catch (err) {
      setSavingsGoalError(
        err instanceof Error ? err.message : "Unable to save savings goal.",
      );
    } finally {
      setSavingsGoalLoading(false);
    }
  }

  function startSavingsGoalEdit(goal: SavingsGoal) {
    setSavingsGoalEditingId(goal.id);
    setSavingsGoalForm({
      name: goal.name,
      target_amount: goal.target_amount.toString(),
      current_amount: goal.current_amount.toString(),
      target_date: goal.target_date || "",
    });
    setSavingsGoalError("");
  }

  function cancelSavingsGoalEdit() {
    setSavingsGoalEditingId(null);
    setSavingsGoalForm(emptySavingsGoalForm);
    setSavingsGoalError("");
  }

  async function changeSavingsGoalBalance(
    goalId: number,
    action: "contribute" | "withdraw",
  ) {
    const amount = Number(contributionAmounts[goalId]);

    if (Number.isNaN(amount) || amount <= 0) {
      setSavingsGoalError("Enter an amount greater than zero.");
      return;
    }

    setSavingsGoalError("");

    try {
      const response = await fetch(
        `${API_URL}/savings-goals/${goalId}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount }),
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail || "Unable to update savings goal.");
      }

      setContributionAmounts({
        ...contributionAmounts,
        [goalId]: "",
      });
      await loadSavingsGoals();
    } catch (err) {
      setSavingsGoalError(
        err instanceof Error ? err.message : "Unable to update savings goal.",
      );
    }
  }

  async function deleteSavingsGoal(id: number) {
    if (!window.confirm("Delete this savings goal?")) {
      return;
    }

    setSavingsGoalError("");

    try {
      const response = await fetch(`${API_URL}/savings-goals/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Unable to delete savings goal.");
      }

      if (savingsGoalEditingId === id) {
        cancelSavingsGoalEdit();
      }
      await loadSavingsGoals();
    } catch (err) {
      setSavingsGoalError(
        err instanceof Error ? err.message : "Unable to delete savings goal.",
      );
    }
  }

  function exportTransactionsToCsv() {
    setCsvError("");
    setCsvMessage("");

    const headers = [
      "description",
      "amount",
      "category",
      "transaction_type",
      "transaction_date",
    ];
    const rows = visibleTransactions.map((transaction) =>
      [
        transaction.description,
        transaction.amount,
        transaction.category,
        transaction.transaction_type,
        transaction.transaction_date,
      ]
        .map(escapeCsvValue)
        .join(","),
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `finsight-transactions-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setCsvMessage(`Exported ${visibleTransactions.length} transactions.`);
  }

  async function importTransactionsFromCsv(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setCsvLoading(true);
    setCsvError("");
    setCsvMessage("");

    try {
      const text = await file.text();
      const lines = text
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .filter((line) => line.trim());

      if (lines.length < 2) {
        throw new Error("The CSV file does not contain any transactions.");
      }

      const requiredHeaders = [
        "description",
        "amount",
        "category",
        "transaction_type",
        "transaction_date",
      ];
      const headers = parseCsvRow(lines[0]).map((header) =>
        header.toLowerCase(),
      );
      const indexes = requiredHeaders.map((header) => headers.indexOf(header));

      if (indexes.some((index) => index === -1)) {
        throw new Error(`CSV headers must be: ${requiredHeaders.join(", ")}`);
      }

      let importedCount = 0;

      for (const line of lines.slice(1)) {
        const values = parseCsvRow(line);
        const [description, amountText, category, type, date] = indexes.map(
          (index) => values[index] || "",
        );
        const amount = Number(amountText);

        if (
          !description ||
          !category ||
          !date ||
          Number.isNaN(amount) ||
          amount <= 0 ||
          !["income", "expense"].includes(type)
        ) {
          throw new Error(
            `Invalid transaction on CSV row ${importedCount + 2}.`,
          );
        }

        const response = await fetch(`${API_URL}/transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description,
            amount,
            category,
            transaction_type: type,
            transaction_date: date,
          }),
        });

        if (!response.ok) {
          throw new Error(
            `Unable to import transaction on CSV row ${importedCount + 2}.`,
          );
        }

        importedCount += 1;
      }

      await loadTransactions();
      setCsvMessage(`Successfully imported ${importedCount} transactions.`);
    } catch (err) {
      setCsvError(
        err instanceof Error ? err.message : "Unable to import CSV file.",
      );
    } finally {
      setCsvLoading(false);
    }
  }

  async function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBudgetError("");

    if (!budgetForm.category || !budgetForm.monthly_limit) {
      setBudgetError("Choose a category and enter a monthly limit.");
      return;
    }

    const monthlyLimit = Number(budgetForm.monthly_limit);

    if (Number.isNaN(monthlyLimit) || monthlyLimit <= 0) {
      setBudgetError("Monthly limit must be greater than zero.");
      return;
    }

    setBudgetLoading(true);

    try {
      const url =
        budgetEditingId === null
          ? `${API_URL}/budgets`
          : `${API_URL}/budgets/${budgetEditingId}`;
      const response = await fetch(url, {
        method: budgetEditingId === null ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: budgetForm.category,
          monthly_limit: monthlyLimit,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.detail || "Unable to save budget.");
      }

      setBudgetForm(emptyBudgetForm);
      setBudgetEditingId(null);
      await loadBudgets();
    } catch (err) {
      setBudgetError(
        err instanceof Error ? err.message : "Unable to save budget.",
      );
    } finally {
      setBudgetLoading(false);
    }
  }

  function startBudgetEdit(budget: Budget) {
    setBudgetEditingId(budget.id);
    setBudgetForm({
      category: budget.category,
      monthly_limit: budget.monthly_limit.toString(),
    });
    setBudgetError("");
  }

  function cancelBudgetEdit() {
    setBudgetEditingId(null);
    setBudgetForm(emptyBudgetForm);
    setBudgetError("");
  }

  async function deleteBudget(id: number) {
    if (!window.confirm("Delete this budget?")) {
      return;
    }

    setBudgetError("");

    try {
      const response = await fetch(`${API_URL}/budgets/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Unable to delete budget.");
      }

      if (budgetEditingId === id) {
        cancelBudgetEdit();
      }
      await loadBudgets();
    } catch (err) {
      setBudgetError(
        err instanceof Error ? err.message : "Unable to delete budget.",
      );
    }
  }

  async function addRecurringTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRecurringError("");

    if (
      !recurringForm.description ||
      !recurringForm.amount ||
      !recurringForm.category ||
      !recurringForm.next_due_date
    ) {
      setRecurringError("Please complete all recurring transaction fields.");
      return;
    }

    const amount = Number(recurringForm.amount);

    if (Number.isNaN(amount) || amount <= 0) {
      setRecurringError("Amount must be greater than zero.");
      return;
    }

    setRecurringLoading(true);

    try {
      const response = await fetch(`${API_URL}/recurring-transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...recurringForm,
          amount,
          is_active: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Unable to create recurring transaction.");
      }

      setRecurringForm({
        ...emptyRecurringForm,
        next_due_date: new Date().toISOString().split("T")[0],
      });
      await Promise.all([loadRecurringTransactions(), loadForecast()]);
    } catch (err) {
      setRecurringError(
        err instanceof Error
          ? err.message
          : "Unable to create recurring transaction.",
      );
    } finally {
      setRecurringLoading(false);
    }
  }

  async function deleteRecurringTransaction(id: number) {
    if (!window.confirm("Delete this recurring transaction?")) {
      return;
    }

    setRecurringError("");

    try {
      const response = await fetch(`${API_URL}/recurring-transactions/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Unable to delete recurring transaction.");
      }

      await Promise.all([loadRecurringTransactions(), loadForecast()]);
    } catch (err) {
      setRecurringError(
        err instanceof Error
          ? err.message
          : "Unable to delete recurring transaction.",
      );
    }
  }

  async function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!form.description || !form.amount || !form.category) {
      setError("Please complete all transaction fields.");
      return;
    }

    const amount = Number(form.amount);

    if (Number.isNaN(amount) || amount <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }

    setLoading(true);

    try {
      const url =
        editingId !== null
          ? `${API_URL}/transactions/${editingId}`
          : `${API_URL}/transactions`;

      const response = await fetch(url, {
        method: editingId !== null ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          description: form.description,
          amount,
          category: form.category,
          transaction_type: form.transaction_type,
          transaction_date: form.transaction_date,
        }),
      });

      if (!response.ok) {
        throw new Error(
          editingId !== null
            ? "Unable to update transaction."
            : "Unable to create transaction.",
        );
      }

      setForm({
        ...emptyForm,
        transaction_date: new Date().toISOString().split("T")[0],
      });

      setEditingId(null);

      await loadTransactions();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save transaction.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function deleteTransaction(id: number) {
    const confirmed = window.confirm("Delete this transaction?");

    if (!confirmed) {
      return;
    }

    setError("");

    try {
      const response = await fetch(`${API_URL}/transactions/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Unable to delete transaction.");
      }

      if (editingId === id) {
        cancelEdit();
      }

      await loadTransactions();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete transaction.",
      );
    }
  }

  function startEdit(transaction: Transaction) {
    setEditingId(transaction.id);

    setForm({
      description: transaction.description,
      amount: transaction.amount.toString(),
      category: transaction.category,
      transaction_type: transaction.transaction_type,
      transaction_date: transaction.transaction_date,
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function cancelEdit() {
    setEditingId(null);

    setForm({
      ...emptyForm,
      transaction_date: new Date().toISOString().split("T")[0],
    });

    setError("");
  }

  async function generateInsights() {
    setAiLoading(true);
    setAiError("");

    try {
      const response = await fetch(`${API_URL}/ai/insights`);

      if (!response.ok) {
        throw new Error("Unable to generate AI insights.");
      }

      const data: AiInsightResponse = await response.json();
      setAiInsight(data.insight);
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : "Unable to generate AI insights.",
      );
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="eyebrow">PERSONAL FINANCE TRACKER</p>

          <h1>FinSight AI</h1>

          <p className="subtitle">
            Understand your money. Make smarter financial decisions.
          </p>
        </div>
      </header>

      <main className="dashboard">
        <section className="summary-grid">
          <div className="summary-card">
            <span>Current Balance</span>
            <strong>${balance.toFixed(2)}</strong>
          </div>

          <div className="summary-card">
            <span>Total Income</span>
            <strong>${totalIncome.toFixed(2)}</strong>
          </div>

          <div className="summary-card">
            <span>Total Expenses</span>
            <strong>${totalExpenses.toFixed(2)}</strong>
          </div>
        </section>

        <section className="content-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">REPORTING PERIOD</p>
              <h2>Filter Your Financial Activity</h2>
            </div>
          </div>

          <div className="transaction-form">
            <div className="form-group">
              <label htmlFor="date-filter">Date Range</label>
              <select
                id="date-filter"
                value={dateFilter}
                onChange={(event) =>
                  setDateFilter(event.target.value as DateFilter)
                }
              >
                <option value="all">All Time</option>
                <option value="current">Current Month</option>
                <option value="previous">Previous Month</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {dateFilter === "custom" && (
              <>
                <div className="form-group">
                  <label htmlFor="custom-start-date">Start Date</label>
                  <input
                    id="custom-start-date"
                    type="date"
                    value={customStartDate}
                    onChange={(event) => setCustomStartDate(event.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="custom-end-date">End Date</label>
                  <input
                    id="custom-end-date"
                    type="date"
                    value={customEndDate}
                    onChange={(event) => setCustomEndDate(event.target.value)}
                  />
                </div>
              </>
            )}
          </div>

          <p className="ai-description">
            Showing {filteredTransactions.length} transaction
            {filteredTransactions.length === 1 ? "" : "s"}. Summary cards,
            charts, and recent activity use this reporting period.
          </p>
        </section>

        <section className="content-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">
                {editingId !== null ? "EDIT TRANSACTION" : "NEW TRANSACTION"}
              </p>

              <h2>
                {editingId !== null
                  ? "Update Transaction"
                  : "Add Income or Expense"}
              </h2>
            </div>
          </div>

          <form className="transaction-form" onSubmit={addTransaction}>
            <div className="form-group">
              <label htmlFor="description">Description</label>

              <input
                id="description"
                type="text"
                value={form.description}
                onChange={(event) =>
                  setForm({
                    ...form,
                    description: event.target.value,
                  })
                }
                placeholder="Example: Walmart Groceries"
              />
            </div>

            <div className="form-group">
              <label htmlFor="amount">Amount</label>

              <input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) =>
                  setForm({
                    ...form,
                    amount: event.target.value,
                  })
                }
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label htmlFor="category">Category</label>

              <select
                id="category"
                value={form.category}
                onChange={(event) =>
                  setForm({
                    ...form,
                    category: event.target.value,
                  })
                }
              >
                <option value="">Select a category</option>

                {(form.transaction_type === "expense"
                  ? expenseCategories
                  : incomeCategories
                ).map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="transaction-type">Type</label>

              <select
                id="transaction-type"
                value={form.transaction_type}
                onChange={(event) =>
                  setForm({
                    ...form,
                    transaction_type: event.target.value as TransactionType,
                    category: "",
                  })
                }
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="transaction-date">Date</label>

              <input
                id="transaction-date"
                type="date"
                value={form.transaction_date}
                onChange={(event) =>
                  setForm({
                    ...form,
                    transaction_date: event.target.value,
                  })
                }
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="add-button" disabled={loading}>
                {loading
                  ? "Saving..."
                  : editingId !== null
                    ? "Update Transaction"
                    : "Add Transaction"}
              </button>

              {editingId !== null && (
                <button
                  type="button"
                  className="cancel-button"
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {error && <p className="error-message">{error}</p>}
        </section>

        <section className="content-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">MONTHLY CASH-FLOW FORECAST</p>
              <h2>Plan Recurring Income and Bills</h2>
            </div>
          </div>

          {forecast && (
            <div className="summary-grid">
              <div className="summary-card">
                <span>Projected Monthly Income</span>
                <strong>${forecast.projected_monthly_income.toFixed(2)}</strong>
              </div>

              <div className="summary-card">
                <span>Projected Monthly Expenses</span>
                <strong>
                  ${forecast.projected_monthly_expenses.toFixed(2)}
                </strong>
              </div>

              <div className="summary-card">
                <span>Projected Net Cash Flow</span>
                <strong>${forecast.projected_net_cash_flow.toFixed(2)}</strong>
              </div>

              <div className="summary-card">
                <span>Projected Ending Balance</span>
                <strong>${forecast.projected_ending_balance.toFixed(2)}</strong>
              </div>
            </div>
          )}

          <form className="transaction-form" onSubmit={addRecurringTransaction}>
            <div className="form-group">
              <label htmlFor="recurring-description">Description</label>
              <input
                id="recurring-description"
                type="text"
                value={recurringForm.description}
                onChange={(event) =>
                  setRecurringForm({
                    ...recurringForm,
                    description: event.target.value,
                  })
                }
                placeholder="Example: Monthly Rent"
              />
            </div>

            <div className="form-group">
              <label htmlFor="recurring-amount">Amount</label>
              <input
                id="recurring-amount"
                type="number"
                min="0"
                step="0.01"
                value={recurringForm.amount}
                onChange={(event) =>
                  setRecurringForm({
                    ...recurringForm,
                    amount: event.target.value,
                  })
                }
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label htmlFor="recurring-type">Type</label>
              <select
                id="recurring-type"
                value={recurringForm.transaction_type}
                onChange={(event) =>
                  setRecurringForm({
                    ...recurringForm,
                    transaction_type: event.target.value as TransactionType,
                    category: "",
                  })
                }
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="recurring-category">Category</label>
              <select
                id="recurring-category"
                value={recurringForm.category}
                onChange={(event) =>
                  setRecurringForm({
                    ...recurringForm,
                    category: event.target.value,
                  })
                }
              >
                <option value="">Select a category</option>
                {(recurringForm.transaction_type === "expense"
                  ? expenseCategories
                  : incomeCategories
                ).map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="recurring-frequency">Frequency</label>
              <select
                id="recurring-frequency"
                value={recurringForm.frequency}
                onChange={(event) =>
                  setRecurringForm({
                    ...recurringForm,
                    frequency: event.target.value as RecurringFrequency,
                  })
                }
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Every Two Weeks</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="recurring-date">Next Due Date</label>
              <input
                id="recurring-date"
                type="date"
                value={recurringForm.next_due_date}
                onChange={(event) =>
                  setRecurringForm({
                    ...recurringForm,
                    next_due_date: event.target.value,
                  })
                }
              />
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="add-button"
                disabled={recurringLoading}
              >
                {recurringLoading ? "Saving..." : "Add Recurring Transaction"}
              </button>
            </div>
          </form>

          {recurringError && <p className="error-message">{recurringError}</p>}

          {recurringTransactions.length === 0 ? (
            <div className="empty-state">
              <h3>No recurring transactions yet</h3>
              <p>
                Add regular income and bills to calculate your monthly forecast.
              </p>
            </div>
          ) : (
            <div className="transaction-list">
              {recurringTransactions.map((recurringTransaction) => (
                <div className="transaction" key={recurringTransaction.id}>
                  <div>
                    <strong>{recurringTransaction.description}</strong>
                    <p>
                      {recurringTransaction.category} •{" "}
                      {recurringTransaction.frequency} • Next due{" "}
                      {recurringTransaction.next_due_date}
                    </p>
                  </div>

                  <div className="transaction-actions">
                    <span>
                      {recurringTransaction.transaction_type === "expense"
                        ? "-"
                        : "+"}
                      ${recurringTransaction.amount.toFixed(2)}
                    </span>
                    <button
                      type="button"
                      className="delete-button"
                      onClick={() =>
                        deleteRecurringTransaction(recurringTransaction.id)
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="content-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">MONTHLY BUDGETS</p>
              <h2>Set Limits and Monitor Spending</h2>
            </div>
          </div>

          <form className="transaction-form" onSubmit={saveBudget}>
            <div className="form-group">
              <label htmlFor="budget-category">Category</label>
              <select
                id="budget-category"
                value={budgetForm.category}
                onChange={(event) =>
                  setBudgetForm({
                    ...budgetForm,
                    category: event.target.value,
                  })
                }
              >
                <option value="">Select a category</option>
                {expenseCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="budget-limit">Monthly Limit</label>
              <input
                id="budget-limit"
                type="number"
                min="0"
                step="0.01"
                value={budgetForm.monthly_limit}
                onChange={(event) =>
                  setBudgetForm({
                    ...budgetForm,
                    monthly_limit: event.target.value,
                  })
                }
                placeholder="Example: 500.00"
              />
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="add-button"
                disabled={budgetLoading}
              >
                {budgetLoading
                  ? "Saving..."
                  : budgetEditingId === null
                    ? "Add Budget"
                    : "Update Budget"}
              </button>

              {budgetEditingId !== null && (
                <button
                  type="button"
                  className="cancel-button"
                  onClick={cancelBudgetEdit}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {budgetError && <p className="error-message">{budgetError}</p>}

          {budgets.length === 0 ? (
            <div className="empty-state">
              <h3>No monthly budgets yet</h3>
              <p>Add a spending limit to monitor a category this month.</p>
            </div>
          ) : (
            <div className="transaction-list">
              {budgets.map((budget) => {
                const spent = currentMonthSpending[budget.category] || 0;
                const remaining = budget.monthly_limit - spent;
                const percentage =
                  budget.monthly_limit > 0
                    ? (spent / budget.monthly_limit) * 100
                    : 0;
                const progressWidth = Math.min(percentage, 100);
                const status =
                  percentage >= 100
                    ? "Over budget"
                    : percentage >= 80
                      ? "Approaching limit"
                      : "On track";
                const statusColor =
                  percentage >= 100
                    ? "#f87171"
                    : percentage >= 80
                      ? "#fbbf24"
                      : "#34d399";

                return (
                  <div className="transaction" key={budget.id}>
                    <div style={{ flex: 1 }}>
                      <strong>{budget.category}</strong>
                      <p>
                        ${spent.toFixed(2)} spent of $
                        {budget.monthly_limit.toFixed(2)} •{" "}
                        {remaining >= 0 ? "$" : "-$"}
                        {Math.abs(remaining).toFixed(2)}{" "}
                        {remaining >= 0 ? "remaining" : "over"}
                      </p>
                      <div
                        style={{
                          height: "10px",
                          marginTop: "10px",
                          overflow: "hidden",
                          borderRadius: "999px",
                          background: "#1e293b",
                        }}
                      >
                        <div
                          style={{
                            width: `${progressWidth}%`,
                            height: "100%",
                            borderRadius: "999px",
                            background: statusColor,
                          }}
                        />
                      </div>
                      <p style={{ color: statusColor, marginTop: "8px" }}>
                        {status} • {percentage.toFixed(0)}%
                      </p>
                    </div>

                    <div className="transaction-actions">
                      <button
                        type="button"
                        className="edit-button"
                        onClick={() => startBudgetEdit(budget)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="delete-button"
                        onClick={() => deleteBudget(budget.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="content-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SAVINGS GOALS</p>
              <h2>Build Toward What Matters</h2>
            </div>
          </div>

          <form className="transaction-form" onSubmit={saveSavingsGoal}>
            <div className="form-group">
              <label htmlFor="goal-name">Goal Name</label>
              <input
                id="goal-name"
                type="text"
                value={savingsGoalForm.name}
                onChange={(event) =>
                  setSavingsGoalForm({
                    ...savingsGoalForm,
                    name: event.target.value,
                  })
                }
                placeholder="Example: Emergency Fund"
              />
            </div>

            <div className="form-group">
              <label htmlFor="goal-target">Target Amount</label>
              <input
                id="goal-target"
                type="number"
                min="0"
                step="0.01"
                value={savingsGoalForm.target_amount}
                onChange={(event) =>
                  setSavingsGoalForm({
                    ...savingsGoalForm,
                    target_amount: event.target.value,
                  })
                }
                placeholder="5000.00"
              />
            </div>

            <div className="form-group">
              <label htmlFor="goal-current">Already Saved</label>
              <input
                id="goal-current"
                type="number"
                min="0"
                step="0.01"
                value={savingsGoalForm.current_amount}
                onChange={(event) =>
                  setSavingsGoalForm({
                    ...savingsGoalForm,
                    current_amount: event.target.value,
                  })
                }
                placeholder="0.00"
              />
            </div>

            <div className="form-group">
              <label htmlFor="goal-date">Target Date (Optional)</label>
              <input
                id="goal-date"
                type="date"
                value={savingsGoalForm.target_date}
                onChange={(event) =>
                  setSavingsGoalForm({
                    ...savingsGoalForm,
                    target_date: event.target.value,
                  })
                }
              />
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="add-button"
                disabled={savingsGoalLoading}
              >
                {savingsGoalLoading
                  ? "Saving..."
                  : savingsGoalEditingId === null
                    ? "Add Savings Goal"
                    : "Update Savings Goal"}
              </button>

              {savingsGoalEditingId !== null && (
                <button
                  type="button"
                  className="cancel-button"
                  onClick={cancelSavingsGoalEdit}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          {savingsGoalError && (
            <p className="error-message">{savingsGoalError}</p>
          )}

          {savingsGoals.length === 0 ? (
            <div className="empty-state">
              <h3>No savings goals yet</h3>
              <p>Create a goal and begin tracking your progress.</p>
            </div>
          ) : (
            <div className="transaction-list">
              {savingsGoals.map((goal) => {
                const percentage = Math.min(
                  (goal.current_amount / goal.target_amount) * 100,
                  100,
                );
                const remaining = goal.target_amount - goal.current_amount;
                const completed = percentage >= 100;

                return (
                  <div className="transaction" key={goal.id}>
                    <div style={{ flex: 1 }}>
                      <strong>{goal.name}</strong>
                      <p>
                        ${goal.current_amount.toFixed(2)} of $
                        {goal.target_amount.toFixed(2)} • $
                        {remaining.toFixed(2)} remaining
                        {goal.target_date
                          ? ` • Target ${goal.target_date}`
                          : ""}
                      </p>
                      <div
                        style={{
                          height: "12px",
                          marginTop: "10px",
                          overflow: "hidden",
                          borderRadius: "999px",
                          background: "#1e293b",
                        }}
                      >
                        <div
                          style={{
                            width: `${percentage}%`,
                            height: "100%",
                            borderRadius: "999px",
                            background: completed ? "#34d399" : "#60a5fa",
                          }}
                        />
                      </div>
                      <p
                        style={{
                          color: completed ? "#34d399" : "#60a5fa",
                          marginTop: "8px",
                        }}
                      >
                        {completed
                          ? "Goal complete!"
                          : `${percentage.toFixed(0)}% complete`}
                      </p>

                      <div className="form-actions">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          aria-label={`Amount for ${goal.name}`}
                          value={contributionAmounts[goal.id] || ""}
                          onChange={(event) =>
                            setContributionAmounts({
                              ...contributionAmounts,
                              [goal.id]: event.target.value,
                            })
                          }
                          placeholder="Amount"
                          style={{ maxWidth: "180px" }}
                        />
                        <button
                          type="button"
                          className="add-button"
                          onClick={() =>
                            changeSavingsGoalBalance(goal.id, "contribute")
                          }
                        >
                          Add Money
                        </button>
                        <button
                          type="button"
                          className="cancel-button"
                          onClick={() =>
                            changeSavingsGoalBalance(goal.id, "withdraw")
                          }
                        >
                          Withdraw
                        </button>
                      </div>
                    </div>

                    <div className="transaction-actions">
                      <button
                        type="button"
                        className="edit-button"
                        onClick={() => startSavingsGoalEdit(goal)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="delete-button"
                        onClick={() => deleteSavingsGoal(goal.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="content-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">SPENDING ANALYSIS</p>
              <h2>Spending by Category</h2>
            </div>
          </div>

          {chartData.length === 0 ? (
            <div className="empty-state">
              <h3>No expense data yet</h3>

              <p>Add expense transactions to see your category totals.</p>
            </div>
          ) : (
            <div className="analytics-grid">
              <div className="chart-card">
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={3}
                    >
                      {chartData.map((entry, index) => (
                        <Cell
                          key={entry.name}
                          fill={chartColors[index % chartColors.length]}
                        />
                      ))}
                    </Pie>

                    <Tooltip
                      formatter={(value) => [
                        `$${Number(value).toFixed(2)}`,
                        "Amount",
                      ]}
                    />

                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="category-list">
                {Object.entries(spendingByCategory)
                  .sort(([, amountA], [, amountB]) => amountB - amountA)
                  .map(([category, amount]) => (
                    <div className="category-row" key={category}>
                      <span>{category}</span>
                      <strong>${amount.toFixed(2)}</strong>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>

        <section className="content-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">MONTHLY TREND</p>
              <h2>Monthly Spending</h2>
            </div>
          </div>

          {monthlyChartData.length === 0 ? (
            <div className="empty-state">
              <h3>No monthly spending data yet</h3>

              <p>
                Add expense transactions from different months to see your
                spending trend.
              </p>
            </div>
          ) : (
            <div className="chart-card">
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis dataKey="month" />

                  <YAxis />

                  <Tooltip
                    formatter={(value) => [
                      `$${Number(value).toFixed(2)}`,
                      "Spending",
                    ]}
                  />

                  <Bar dataKey="amount" fill="#60a5fa" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="content-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">AI FINANCIAL INSIGHTS</p>
              <h2>Personalized Financial Analysis</h2>
            </div>
          </div>

          <div className="ai-insights">
            <p className="ai-description">
              Generate AI-powered insights based on your transaction history and
              spending patterns.
            </p>

            <button
              type="button"
              className="add-button"
              onClick={generateInsights}
              disabled={aiLoading}
            >
              {aiLoading
                ? "Analyzing..."
                : aiInsight
                  ? "Generate New Insight"
                  : "Generate AI Insights"}
            </button>

            {aiError && <p className="error-message">{aiError}</p>}

            {aiInsight && (
              <div className="ai-result">
                <h3>Your Financial Insights</h3>

                <div className="ai-markdown">
                  <ReactMarkdown>{aiInsight}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="content-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ACTIVITY</p>
              <h2>Recent Transactions</h2>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="add-button"
              onClick={exportTransactionsToCsv}
            >
              Export Visible CSV
            </button>

            <label className="cancel-button" style={{ cursor: "pointer" }}>
              {csvLoading ? "Importing..." : "Import CSV"}
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={csvLoading}
                onChange={importTransactionsFromCsv}
                style={{ display: "none" }}
              />
            </label>
          </div>

          {csvMessage && <p className="success-message">{csvMessage}</p>}
          {csvError && <p className="error-message">{csvError}</p>}

          <div className="transaction-form">
            <div className="form-group">
              <label htmlFor="transaction-search">Search</label>
              <input
                id="transaction-search"
                type="search"
                value={transactionSearch}
                onChange={(event) => setTransactionSearch(event.target.value)}
                placeholder="Search description or category"
              />
            </div>

            <div className="form-group">
              <label htmlFor="transaction-type-filter">Type</label>
              <select
                id="transaction-type-filter"
                value={transactionTypeFilter}
                onChange={(event) =>
                  setTransactionTypeFilter(
                    event.target.value as "all" | TransactionType,
                  )
                }
              >
                <option value="all">All Types</option>
                <option value="income">Income</option>
                <option value="expense">Expenses</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="transaction-category-filter">Category</label>
              <select
                id="transaction-category-filter"
                value={transactionCategoryFilter}
                onChange={(event) =>
                  setTransactionCategoryFilter(event.target.value)
                }
              >
                <option value="all">All Categories</option>
                {availableTransactionCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={() => {
                  setTransactionSearch("");
                  setTransactionTypeFilter("all");
                  setTransactionCategoryFilter("all");
                }}
              >
                Clear Filters
              </button>
            </div>
          </div>

          <p className="ai-description">
            Showing {visibleTransactions.length} of{" "}
            {filteredTransactions.length} transactions in this period.
          </p>

          {visibleTransactions.length === 0 ? (
            <div className="empty-state">
              <h3>No matching transactions</h3>

              <p>
                Adjust the search, filters, or reporting period to see
                transactions.
              </p>
            </div>
          ) : (
            <div className="transaction-list">
              {visibleTransactions.map((transaction) => (
                <div className="transaction" key={transaction.id}>
                  <div>
                    <strong>{transaction.description}</strong>

                    <p>
                      {transaction.category} • {transaction.transaction_date}
                    </p>
                  </div>

                  <div className="transaction-actions">
                    <span>
                      {transaction.transaction_type === "expense" ? "-" : "+"}$
                      {transaction.amount.toFixed(2)}
                    </span>

                    <button
                      type="button"
                      className="edit-button"
                      onClick={() => startEdit(transaction)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="delete-button"
                      onClick={() => deleteTransaction(transaction.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
