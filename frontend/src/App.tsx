import { useEffect, useState } from "react";
import type { FormEvent } from "react";
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

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [form, setForm] = useState<TransactionForm>(emptyForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const totalIncome = transactions
    .filter((transaction) => transaction.transaction_type === "income")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const totalExpenses = transactions
    .filter((transaction) => transaction.transaction_type === "expense")
    .reduce((total, transaction) => total + transaction.amount, 0);

  const balance = totalIncome - totalExpenses;

  async function loadTransactions() {
    try {
      const response = await fetch("http://127.0.0.1:8000/transactions");

      if (!response.ok) {
        throw new Error("Unable to load transactions.");
      }

      const data = await response.json();
      setTransactions(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load transactions."
      );
    }
  }

  useEffect(() => {
    loadTransactions();
  }, []);

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
      const response = await fetch("http://127.0.0.1:8000/transactions", {
        method: "POST",
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
        throw new Error("Unable to create transaction.");
      }

      setForm({
        ...emptyForm,
        transaction_date: new Date().toISOString().split("T")[0],
      });

      await loadTransactions();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create transaction."
      );
    } finally {
      setLoading(false);
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
              <p className="eyebrow">NEW TRANSACTION</p>
              <h2>Add Income or Expense</h2>
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
              <input
                id="category"
                type="text"
                value={form.category}
                onChange={(event) =>
                  setForm({
                    ...form,
                    category: event.target.value,
                  })
                }
                placeholder="Example: Groceries"
              />
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

            <button type="submit" className="add-button" disabled={loading}>
              {loading ? "Adding..." : "Add Transaction"}
            </button>
          </form>

          {error && <p className="error-message">{error}</p>}
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
                Your income and expenses will appear here once you add them.
              </p>
            </div>
          ) : (
            <div className="transaction-list">
              {transactions.map((transaction) => (
                <div className="transaction" key={transaction.id}>
                  <div>
                    <strong>{transaction.description}</strong>
                    <p>
                      {transaction.category} • {transaction.transaction_date}
                    </p>
                  </div>

                  <span>
                    {transaction.transaction_type === "expense" ? "-" : "+"}$
                    {transaction.amount.toFixed(2)}
                  </span>
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