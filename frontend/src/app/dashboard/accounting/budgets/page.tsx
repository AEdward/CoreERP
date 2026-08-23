"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type Account, type Budget, type BudgetVsActualRow } from "@/lib/api";
import { useSession } from "@/lib/useSession";

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

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("accounting.manage") ?? false;
  const accountLabel = (id: number) => {
    const a = glAccounts?.find((acc) => acc.id === id);
    return a ? `${a.code} ${a.name}` : "—";
  };

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <AppHeader activeMembership={activeMembership} />

      {!activeMembership ? (
        <p style={{ color: "#666" }}>
          Pick an active company on the <a href="/dashboard">dashboard</a> first.
        </p>
      ) : (
        <>
          <h1 style={{ fontSize: 20 }}>Budgets — {activeMembership.company.name}</h1>
          <p style={{ color: "#666", fontSize: 13 }}>
            <a href="/dashboard/accounting">&larr; Back to Accounting</a>
          </p>
          {loadError && <p style={{ color: "crimson" }}>{loadError}</p>}

          <section style={{ marginTop: 24, marginBottom: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Budgets
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Account</th>
                  <th style={{ padding: "6px 4px" }}>Period</th>
                  <th style={{ padding: "6px 4px" }}>Amount</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {budgets?.map((b) => (
                  <tr key={b.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{accountLabel(b.account)}</td>
                    <td style={{ padding: "6px 4px" }}>{b.period_label}</td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(b.amount_cents)}</td>
                    {canManage && (
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
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
                    <td colSpan={4} style={{ padding: "6px 4px", color: "#999" }}>
                      No budgets yet.
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
                  value={form.account}
                  onChange={(e) => setForm({ ...form, account: e.target.value })}
                  style={{ padding: 8 }}
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
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Budgeted amount"
                  type="number"
                  step="0.01"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  style={{ padding: 8 }}
                />
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                  <button type="submit" disabled={working || !form.account} style={{ padding: "8px 16px" }}>
                    {editingId ? "Save changes" : "Add budget"}
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

          <section style={{ marginTop: 24, marginBottom: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Budget vs actual
            </h2>
            <p style={{ fontSize: 12, color: "#999", maxWidth: 600 }}>
              Actual is all-time activity on the account (no date range filtering yet, same
              limitation as the other reports) — read it as &quot;since the last period close&quot;
              if you close periods regularly.
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Account</th>
                  <th style={{ padding: "6px 4px" }}>Period</th>
                  <th style={{ padding: "6px 4px" }}>Budget</th>
                  <th style={{ padding: "6px 4px" }}>Actual</th>
                  <th style={{ padding: "6px 4px" }}>Variance</th>
                </tr>
              </thead>
              <tbody>
                {rows?.map((r) => (
                  <tr key={r.budget_id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>
                      {r.account_code} {r.account_name}
                    </td>
                    <td style={{ padding: "6px 4px" }}>{r.period_label}</td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(r.budget_cents)}</td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(r.actual_cents)}</td>
                    <td
                      style={{
                        padding: "6px 4px",
                        color: r.variance_cents < 0 ? "#c62828" : "#2e7d32",
                      }}
                    >
                      {formatCents(r.variance_cents)}
                    </td>
                  </tr>
                ))}
                {rows?.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "6px 4px", color: "#999" }}>
                      No budgets to compare yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </>
      )}
    </main>
  );
}
