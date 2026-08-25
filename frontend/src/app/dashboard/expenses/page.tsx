"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { ActivityPanel } from "@/components/ActivityPanel";
import { ApprovalPanel } from "@/components/ApprovalPanel";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { NotesPanel } from "@/components/NotesPanel";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type EmployeePickerEntry, type Expense } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const STATUS_LABELS: Record<Expense["status"], string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
};

const STATUS_BADGES: Record<Expense["status"], string> = {
  draft: "",
  submitted: shared.badgeWarn,
  approved: shared.badgeSuccess,
  rejected: shared.badgeDanger,
  paid: shared.badgeInfo,
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

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("expenses.manage") ?? false;
  const employeeName = (id: number) => employees?.find((e) => e.id === id)?.name ?? "—";

  return (
    <ModuleShell moduleKey="expenses" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Expenses</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        <p className={shared.hint} style={{ marginBottom: 16 }}>
          File an expense claim, then request approval from the Approval panel on its row. Once
          approved, it can be paid the same way a supplier bill is, from Accounting.
        </p>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.card}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Status</th>
                <th></th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {expenses?.map((exp) => (
                <tr key={exp.id}>
                  <td>{employeeName(exp.employee)}</td>
                  <td>
                    {exp.category}
                    {exp.description && <div className={shared.tableMuted}>{exp.description}</div>}
                  </td>
                  <td>{formatCents(exp.amount_cents)}</td>
                  <td>{exp.expense_date}</td>
                  <td>
                    <span className={`${shared.badge} ${STATUS_BADGES[exp.status]}`}>
                      {STATUS_LABELS[exp.status]}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
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
                    <td style={{ textAlign: "right" }}>
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
                  <td colSpan={7} className={shared.tableMuted}>
                    No expenses yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {canManage && (
            <form onSubmit={handleSubmit} className={shared.formGrid} style={{ marginTop: 16 }}>
              <select
                required
                value={form.employee}
                onChange={(e) => setForm({ ...form, employee: e.target.value })}
                className={shared.select}
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
                className={shared.input}
              />
              <input
                placeholder="Amount"
                type="number"
                step="0.01"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className={shared.input}
              />
              <input
                type="date"
                required
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                className={shared.input}
              />
              <input
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={shared.input}
                style={{ gridColumn: "1 / -1" }}
              />
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                <button
                  type="submit"
                  disabled={working || !form.employee || !form.category}
                  className={`${shared.btn} ${shared.btnPrimary}`}
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
                    className={shared.btn}
                  >
                    Cancel
                  </button>
                )}
              </div>
              {error && (
                <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                  {error}
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </ModuleShell>
  );
}
