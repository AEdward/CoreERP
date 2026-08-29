"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type Customer, type LeaseContract, type PropertyUnit } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const STATUS_BADGES: Record<LeaseContract["status"], string> = {
  active: shared.badgeSuccess,
  terminated: shared.badgeDanger,
  expired: shared.badgeWarn,
};

const EMPTY_FORM = { unit: "", tenant: "", start_date: "", end_date: "", monthly_rent_cents: "", deposit_cents: "" };

export default function LeasingPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [leases, setLeases] = useState<LeaseContract[] | null>(null);
  const [units, setUnits] = useState<PropertyUnit[] | null>(null);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadAll() {
    try {
      const [l, u, c] = await Promise.all([api.listLeaseContracts(), api.listPropertyUnits(), api.listCustomers()]);
      setLeases(l);
      setUnits(u.filter((unit) => unit.status === "available"));
      setCustomers(c);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load leases.");
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
      await api.createLeaseContract({
        unit: Number(form.unit),
        tenant: Number(form.tenant),
        start_date: form.start_date,
        end_date: form.end_date,
        monthly_rent_cents: Math.round(Number(form.monthly_rent_cents) * 100),
        deposit_cents: form.deposit_cents ? Math.round(Number(form.deposit_cents) * 100) : 0,
      });
      setForm(EMPTY_FORM);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to create lease.");
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
            <h1 className={shared.pageTitle}>Leasing</h1>
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
                  <th>Tenant</th>
                  <th>Monthly rent</th>
                  <th>Term</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {leases?.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <Link href={`/dashboard/realestate/leasing/${l.id}`}>{l.number}</Link>
                    </td>
                    <td>{l.unit_label}</td>
                    <td className={shared.tableMuted}>{l.tenant_name}</td>
                    <td className={shared.tableMuted}>{formatCents(l.monthly_rent_cents)}</td>
                    <td className={shared.tableMuted}>
                      {l.start_date} → {l.end_date}
                    </td>
                    <td>
                      <span className={`${shared.badge} ${STATUS_BADGES[l.status]}`}>{l.status}</span>
                    </td>
                  </tr>
                ))}
                {leases?.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      No lease contracts yet.
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
                  value={form.tenant}
                  onChange={(e) => setForm({ ...form, tenant: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Tenant…</option>
                  {customers?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  required
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className={shared.input}
                />
                <input
                  type="date"
                  required
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className={shared.input}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Monthly rent"
                  required
                  value={form.monthly_rent_cents}
                  onChange={(e) => setForm({ ...form, monthly_rent_cents: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 130 }}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Deposit"
                  value={form.deposit_cents}
                  onChange={(e) => setForm({ ...form, deposit_cents: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 130 }}
                />
                <button
                  type="submit"
                  disabled={
                    working || !form.unit || !form.tenant || !form.start_date || !form.end_date || !form.monthly_rent_cents
                  }
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Create lease
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
