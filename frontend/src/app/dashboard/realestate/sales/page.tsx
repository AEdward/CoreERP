"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type Customer, type PropertySale, type PropertyUnit, type SalesAgent } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const STATUS_BADGES: Record<PropertySale["status"], string> = {
  pending: shared.badgeWarn,
  completed: shared.badgeSuccess,
  cancelled: shared.badgeDanger,
};

const EMPTY_FORM = {
  unit: "",
  buyer: "",
  agent: "",
  sale_price_cents: "",
  down_payment_cents: "",
  sale_date: "",
};

export default function PropertySalesPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [sales, setSales] = useState<PropertySale[] | null>(null);
  const [units, setUnits] = useState<PropertyUnit[] | null>(null);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [agents, setAgents] = useState<SalesAgent[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadAll() {
    try {
      const [s, u, c, a] = await Promise.all([
        api.listPropertySales(),
        api.listPropertyUnits(),
        api.listCustomers(),
        api.listSalesAgents(),
      ]);
      setSales(s);
      setUnits(u.filter((unit) => unit.status === "available"));
      setCustomers(c);
      setAgents(a);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load sales.");
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
      await api.createPropertySale({
        unit: Number(form.unit),
        buyer: Number(form.buyer),
        agent: form.agent ? Number(form.agent) : null,
        sale_price_cents: Math.round(Number(form.sale_price_cents) * 100),
        down_payment_cents: form.down_payment_cents ? Math.round(Number(form.down_payment_cents) * 100) : 0,
        sale_date: form.sale_date,
      });
      setForm(EMPTY_FORM);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to create sale.");
    } finally {
      setWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("realestate.manage") ?? false;

  return (
    <ModuleShell moduleKey="realestate" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Sales</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.section}>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Unit</th>
                  <th>Buyer</th>
                  <th>Agent</th>
                  <th>Price</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sales?.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/dashboard/realestate/sales/${s.id}`}>{s.number}</Link>
                    </td>
                    <td>{s.unit_label}</td>
                    <td className={shared.tableMuted}>{s.buyer_name}</td>
                    <td className={shared.tableMuted}>{s.agent_name || "—"}</td>
                    <td className={shared.tableMuted}>{formatCents(s.sale_price_cents)}</td>
                    <td>
                      <span className={`${shared.badge} ${STATUS_BADGES[s.status]}`}>{s.status}</span>
                    </td>
                  </tr>
                ))}
                {sales?.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      No sales yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form onSubmit={handleCreate} className={shared.formRow} style={{ marginTop: 12, flexWrap: "wrap" }}>
                <select
                  required
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Available unit…</option>
                  {units?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.building_name} — {u.unit_number}
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={form.buyer}
                  onChange={(e) => setForm({ ...form, buyer: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Buyer…</option>
                  {customers?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  value={form.agent}
                  onChange={(e) => setForm({ ...form, agent: e.target.value })}
                  className={shared.select}
                >
                  <option value="">No agent…</option>
                  {agents?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Sale price"
                  required
                  value={form.sale_price_cents}
                  onChange={(e) => setForm({ ...form, sale_price_cents: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 130 }}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Down payment"
                  value={form.down_payment_cents}
                  onChange={(e) => setForm({ ...form, down_payment_cents: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 130 }}
                />
                <input
                  type="date"
                  required
                  value={form.sale_date}
                  onChange={(e) => setForm({ ...form, sale_date: e.target.value })}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={working || !form.unit || !form.buyer || !form.sale_price_cents || !form.sale_date}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Create sale
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
