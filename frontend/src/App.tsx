import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import "./App.css";

type TransactionType = "income" | "expense";

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

const emptyForm: TransactionForm = {
  description: "",
  amount: "",
  category: "",
  transaction_type: "expense",
  transaction_date: new Date().toISOString().split("T")[0],
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

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [form, setForm] = useState<TransactionForm>(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const totalIncome = transactions
    .filter((transaction) => transaction.transaction_type === "income")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const totalExpenses = transactions
    .filter((transaction) => transaction.transaction_type === "expense")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const balance = totalIncome - totalExpenses;

  const spendingByCategory = transactions
    .filter((transaction) => transaction.transaction_type === "expense")
    .reduce<Record<string, number>>((totals, transaction) => {
      totals[transaction.category] =
        (totals[transaction.category] || 0) + transaction.amount;

      return totals;
    }, {});

  const chartData = Object.entries(spendingByCategory).map(
    ([name, value]) => ({
      name,
      value,
    })
  );

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

  async function loadTransactions() {
    try {
      const response = await fetch(
        "http://127.0.0.1:8000/transactions"
      );

      if (!response.ok) {
        throw new Error("Unable to load transactions.");
      }

      const data: Transaction[] = await response.json();
      setTransactions(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load transactions."
      );
    }
  }

  useEffect(() => {
    loadTransactions();
  }, []);

  async function addTransaction(
    event: FormEvent<HTMLFormElement>
  ) {
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
          ? `http://127.0.0.1:8000/transactions/${editingId}`
          : "http://127.0.0.1:8000/transactions";

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
            : "Unable to create transaction."
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
        err instanceof Error
          ? err.message
          : "Unable to save transaction."
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
      const response = await fetch(
        `http://127.0.0.1:8000/transactions/${id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Unable to delete transaction.");
      }

      if (editingId === id) {
        cancelEdit();
      }

      await loadTransactions();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete transaction."
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
              <p className="eyebrow">
                {editingId !== null
                  ? "EDIT TRANSACTION"
                  : "NEW TRANSACTION"}
              </p>

              <h2>
                {editingId !== null
                  ? "Update Transaction"
                  : "Add Income or Expense"}
              </h2>
            </div>
          </div>

          <form
            className="transaction-form"
            onSubmit={addTransaction}
          >
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
                    transaction_type:
                      event.target.value as TransactionType,
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
              <button
                type="submit"
                className="add-button"
                disabled={loading}
              >
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
              <p className="eyebrow">SPENDING ANALYSIS</p>
              <h2>Spending by Category</h2>
            </div>
          </div>

          {chartData.length === 0 ? (
            <div className="empty-state">
              <h3>No expense data yet</h3>

              <p>
                Add expense transactions to see your category totals.
              </p>
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
                          fill={
                            chartColors[
                              index % chartColors.length
                            ]
                          }
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
                  .sort(
                    ([, amountA], [, amountB]) =>
                      amountB - amountA
                  )
                  .map(([category, amount]) => (
                    <div
                      className="category-row"
                      key={category}
                    >
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
              <p className="eyebrow">ACTIVITY</p>
              <h2>Recent Transactions</h2>
            </div>
          </div>

          {transactions.length === 0 ? (
            <div className="empty-state">
              <h3>No transactions yet</h3>

              <p>
                Your income and expenses will appear here once you
                add them.
              </p>
            </div>
          ) : (
            <div className="transaction-list">
              {transactions.map((transaction) => (
                <div
                  className="transaction"
                  key={transaction.id}
                >
                  <div>
                    <strong>{transaction.description}</strong>

                    <p>
                      {transaction.category} •{" "}
                      {transaction.transaction_date}
                    </p>
                  </div>

                  <div className="transaction-actions">
                    <span>
                      {transaction.transaction_type === "expense"
                        ? "-"
                        : "+"}
                      ${transaction.amount.toFixed(2)}
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
                      onClick={() =>
                        deleteTransaction(transaction.id)
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
      </main>
    </div>
  );
}

export default App;