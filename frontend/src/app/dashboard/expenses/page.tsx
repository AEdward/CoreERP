"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ActivityPanel } from "@/components/ActivityPanel";
import { ApprovalPanel } from "@/components/ApprovalPanel";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { NotesPanel } from "@/components/NotesPanel";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type EmployeePickerEntry, type Expense } from "@/lib/api";
import { useSession } from "@/lib/useSession";

const STATUS_LABELS: Record<Expense["status"], string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

const STATUS_COLORS: Record<Expense["status"], string> = {
  draft: "#666",
  submitted: "#e65100",
  approved: "#2e7d32",
  rejected: "#c62828",
  paid: "#1565c0",
};

const EMPTY_FORM = {
  employee: "",
  category: "",
  description: "",
  amount: "",
  expense_date: "",
};

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function ExpensesPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [employees, setEmployees] = useState<EmployeePickerEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function loadAll() {
    try {
      const [e, emp] = await Promise.all([api.listExpenses(), api.listEmployeePicker()]);
      setExpenses(e);
      setEmployees(emp);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load expenses.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setError(null);
    try {
      const payload = {
        employee: Number(form.employee),
        category: form.category,
        description: form.description,
        amount_cents: Math.round(Number(form.amount || 0) * 100),
        expense_date: form.expense_date,
      };
      if (editingId) {
        await api.updateExpense(editingId, payload);
      } else {
        await api.createExpense(payload);
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save expense.");
    } finally {
      setWorking(false);
    }
  }

  function startEdit(exp: Expense) {
    setEditingId(exp.id);
    setForm({
      employee: String(exp.employee),
      category: exp.category,
      description: exp.description,
      amount: (exp.amount_cents / 100).toString(),
      expense_date: exp.expense_date,
    });
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteExpense(id);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete expense.");
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("expenses.manage") ?? false;
  const employeeName = (id: number) => employees?.find((e) => e.id === id)?.name ?? "—";

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <AppHeader activeMembership={activeMembership} />

      {!activeMembership ? (
        <p style={{ color: "#666" }}>
          Pick an active company on the <a href="/dashboard">dashboard</a> first.
        </p>
      ) : (
        <>
          <h1 style={{ fontSize: 20 }}>Expenses — {activeMembership.company.name}</h1>
          <p style={{ color: "#666", fontSize: 13 }}>
            File an expense claim, then request approval from the Approval panel on its row. Once
            approved, it can be paid the same way a supplier bill is, from Accounting.
          </p>
          {loadError && <p style={{ color: "crimson" }}>{loadError}</p>}

          <section style={{ marginTop: 24, marginBottom: 40 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Employee</th>
                  <th style={{ padding: "6px 4px" }}>Category</th>
                  <th style={{ padding: "6px 4px" }}>Amount</th>
                  <th style={{ padding: "6px 4px" }}>Date</th>
                  <th style={{ padding: "6px 4px" }}>Status</th>
                  <th style={{ padding: "6px 4px" }}></th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {expenses?.map((exp) => (
                  <tr key={exp.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{employeeName(exp.employee)}</td>
                    <td style={{ padding: "6px 4px" }}>
                      {exp.category}
                      {exp.description && (
                        <div style={{ fontSize: 12, color: "#999" }}>{exp.description}</div>
                      )}
                    </td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(exp.amount_cents)}</td>
                    <td style={{ padding: "6px 4px" }}>{exp.expense_date}</td>
                    <td style={{ padding: "6px 4px" }}>
                      <span style={{ color: STATUS_COLORS[exp.status], fontWeight: 600 }}>
                        {STATUS_LABELS[exp.status]}
                      </span>
                    </td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>
                      <span style={{ display: "inline-flex", gap: 6 }}>
                        <DocumentsPanel
                          target={{ appLabel: "expenses", model: "expense", objectId: exp.id }}
                          canManage={canManage}
                        />
                        <NotesPanel
                          target={{ appLabel: "expenses", model: "expense", objectId: exp.id }}
                          canManage={canManage}
                        />
                        <ActivityPanel
                          target={{ appLabel: "expenses", model: "expense", objectId: exp.id }}
                        />
                        <ApprovalPanel
                          target={{ appLabel: "expenses", model: "expense", objectId: exp.id }}
                          canManage={canManage}
                        />
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
                        <RowActions
                          onEdit={() => startEdit(exp)}
                          onDelete={() => handleDelete(exp.id)}
                          disabled={working}
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {expenses?.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: "6px 4px", color: "#999" }}>
                      No expenses yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form
                onSubmit={handleSubmit}
                style={{
                  marginTop: 16,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 8,
                  maxWidth: 800,
                }}
              >
                <select
                  required
                  value={form.employee}
                  onChange={(e) => setForm({ ...form, employee: e.target.value })}
                  style={{ padding: 8 }}
                >
                  <option value="">Employee…</option>
                  {employees?.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Category (e.g. Travel)"
                  required
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Amount"
                  type="number"
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  type="date"
                  required
                  value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Description (optional)"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ padding: 8, gridColumn: "1 / -1" }}
                />
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                  <button
                    type="submit"
                    disabled={working || !form.employee || !form.category}
                    style={{ padding: "8px 16px" }}
                  >
                    {editingId ? "Save changes" : "Add expense"}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setForm(EMPTY_FORM);
                      }}
                      style={{ padding: "8px 16px" }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {error && <p style={{ color: "crimson", gridColumn: "1 / -1", margin: 0 }}>{error}</p>}
              </form>
            )}
          </section>
        </>
      )}
    </main>
  );
}
