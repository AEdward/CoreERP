"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type Account, type Budget, type BudgetVsActualRow } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const EMPTY_FORM = { account: "", period_label: "", amount: "" };

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function BudgetsPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [budgets, setBudgets] = useState<Budget[] | null>(null);
  const [glAccounts, setGlAccounts] = useState<Account[] | null>(null);
  const [rows, setRows] = useState<BudgetVsActualRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  async function loadAll() {
    try {
      const [b, gl, r] = await Promise.all([api.listBudgets(), api.listAccounts(), api.budgetVsActual()]);
      setBudgets(b);
      setGlAccounts(gl);
      setRows(r);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load budgets.");
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
        account: Number(form.account),
        period_label: form.period_label,
        amount_cents: Math.round(Number(form.amount || 0) * 100),
      };
      if (editingId) {
        await api.updateBudget(editingId, payload);
      } else {
        await api.createBudget(payload);
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save budget.");
    } finally {
      setWorking(false);
    }
  }

  function startEdit(b: Budget) {
    setEditingId(b.id);
    setForm({
      account: String(b.account),
      period_label: b.period_label,
      amount: (b.amount_cents / 100).toString(),
    });
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteBudget(id);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete budget.");
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("accounting.manage") ?? false;
  const accountLabel = (id: number) => {
    const a = glAccounts?.find((acc) => acc.id === id);
    return a ? `${a.code} ${a.name}` : "—";
  };

  return (
    <ModuleShell moduleKey="accounting" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Budgets</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.card} style={{ marginBottom: 24 }}>
          <h2 className={shared.sectionTitle}>Budgets</h2>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Account</th>
                <th>Period</th>
                <th>Amount</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {budgets?.map((b) => (
                <tr key={b.id}>
                  <td>{accountLabel(b.account)}</td>
                  <td>{b.period_label}</td>
                  <td>{formatCents(b.amount_cents)}</td>
                  {canManage && (
                    <td style={{ textAlign: "right" }}>
                      <RowActions
                        onEdit={() => startEdit(b)}
                        onDelete={() => handleDelete(b.id)}
                        disabled={working}
                      />
                    </td>
                  )}
                </tr>
              ))}
              {budgets?.length === 0 && (
                <tr>
                  <td colSpan={4} className={shared.tableMuted}>
                    No budgets yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {canManage && (
            <form onSubmit={handleSubmit} className={shared.formGrid} style={{ marginTop: 16 }}>
              <select
                required
                value={form.account}
                onChange={(e) => setForm({ ...form, account: e.target.value })}
                className={shared.select}
              >
                <option value="">Account…</option>
                {glAccounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} {a.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="Period label (e.g. FY2026 Q1)"
                required
                value={form.period_label}
                onChange={(e) => setForm({ ...form, period_label: e.target.value })}
                className={shared.input}
              />
              <input
                placeholder="Budgeted amount"
                type="number"
                step="0.01"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className={shared.input}
              />
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                <button
                  type="submit"
                  disabled={working || !form.account}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  {editingId ? "Save changes" : "Add budget"}
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

        <div className={shared.card}>
          <h2 className={shared.sectionTitle}>Budget vs actual</h2>
          <p className={shared.hint} style={{ maxWidth: 600, marginBottom: 8 }}>
            Actual is all-time activity on the account (no date range filtering yet, same
            limitation as the other reports) — read it as &quot;since the last period close&quot;
            if you close periods regularly.
          </p>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Account</th>
                <th>Period</th>
                <th>Budget</th>
                <th>Actual</th>
                <th>Variance</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((r) => (
                <tr key={r.budget_id}>
                  <td>
                    {r.account_code} {r.account_name}
                  </td>
                  <td>{r.period_label}</td>
                  <td>{formatCents(r.budget_cents)}</td>
                  <td>{formatCents(r.actual_cents)}</td>
                  <td>
                    <span
                      className={`${shared.badge} ${r.variance_cents < 0 ? shared.badgeDanger : shared.badgeSuccess}`}
                    >
                      {formatCents(r.variance_cents)}
                    </span>
                  </td>
                </tr>
              ))}
              {rows?.length === 0 && (
                <tr>
                  <td colSpan={5} className={shared.tableMuted}>
                    No budgets to compare yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </ModuleShell>
  );
}
