"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type PropertyExpense, type RealEstateBuilding, type PropertyUnit } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const EMPTY_FORM = { building: "", unit: "", category: "", amount_cents: "", expense_date: "" };

export default function PropertyExpensesPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [expenses, setExpenses] = useState<PropertyExpense[] | null>(null);
  const [buildings, setBuildings] = useState<RealEstateBuilding[] | null>(null);
  const [units, setUnits] = useState<PropertyUnit[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadAll() {
    try {
      const [e, b, u] = await Promise.all([
        api.listPropertyExpenses(),
        api.listRealEstateBuildings(),
        api.listPropertyUnits(),
      ]);
      setExpenses(e);
      setBuildings(b);
      setUnits(u);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load property expenses.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    try {
      await api.createPropertyExpense({
        building: Number(form.building),
        unit: form.unit ? Number(form.unit) : null,
        category: form.category,
        amount_cents: Math.round(Number(form.amount_cents) * 100),
        expense_date: form.expense_date,
      });
      setForm(EMPTY_FORM);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save expense.");
    } finally {
      setWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("realestate.manage") ?? false;
  const unitsForBuilding = units?.filter((u) => String(u.building) === form.building) ?? [];

  return (
    <ModuleShell moduleKey="realestate" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Property Expenses</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.section}>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Building</th>
                  <th>Unit</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {expenses?.map((e) => (
                  <tr key={e.id}>
                    <td>{e.building_name}</td>
                    <td className={shared.tableMuted}>{e.unit_label || "—"}</td>
                    <td className={shared.tableMuted}>{e.category}</td>
                    <td className={shared.tableMuted}>{formatCents(e.amount_cents)}</td>
                    <td className={shared.tableMuted}>{e.expense_date}</td>
                  </tr>
                ))}
                {expenses?.length === 0 && (
                  <tr>
                    <td colSpan={5} className={shared.tableMuted}>
                      No expenses logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleCreate} className={shared.formRow} style={{ marginTop: 12 }}>
                <select
                  required
                  value={form.building}
                  onChange={(e) => setForm({ ...form, building: e.target.value, unit: "" })}
                  className={shared.select}
                >
                  <option value="">Building…</option>
                  {buildings?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className={shared.select}
                  disabled={!form.building}
                >
                  <option value="">Whole building…</option>
                  {unitsForBuilding.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.unit_number}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Category (e.g. Utilities)"
                  required
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className={shared.input}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Amount"
                  required
                  value={form.amount_cents}
                  onChange={(e) => setForm({ ...form, amount_cents: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 120 }}
                />
                <input
                  type="date"
                  required
                  value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={working || !form.building || !form.category || !form.amount_cents || !form.expense_date}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Log expense
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
