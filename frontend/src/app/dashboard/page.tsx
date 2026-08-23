"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { ModuleIcon } from "@/components/ModuleIcons";
import { api, ApiError, type CompanySummary } from "@/lib/api";
import { useSession } from "@/lib/useSession";

const MODULE_TILES = [
  { key: "settings", label: "Settings", permission: "settings.view", href: "/dashboard/settings" },
  {
    key: "accounting",
    label: "Accounting",
    permission: "accounting.view",
    href: "/dashboard/accounting",
  },
  { key: "hr", label: "HR", permission: "hr.view", href: "/dashboard/hr" },
  { key: "sales", label: "Sales & CRM", permission: "sales.view", href: "/dashboard/sales" },
  {
    key: "inventory",
    label: "Inventory & Catalog",
    permission: "inventory.view",
    href: "/dashboard/inventory",
  },
  {
    key: "procurement",
    label: "Procurement",
    permission: "procurement.view",
    href: "/dashboard/procurement",
  },
  { key: "expenses", label: "Expenses", permission: "expenses.view", href: "/dashboard/expenses" },
  { key: "tasks", label: "Tasks", permission: "tasks.view", href: "/dashboard/tasks" },
  { key: "calendar", label: "Calendar", permission: "calendar.view", href: "/dashboard/calendar" },
];

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

function StatCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div
      style={{
        padding: 16,
        border: "1px solid #ddd",
        borderRadius: 8,
        minWidth: 140,
        background: warn ? "#fff8f0" : "white",
      }}
    >
      <div style={{ fontSize: 12, color: "#999", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: warn ? "#b45309" : "inherit" }}>
        {value}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { me, activeMembership, error: sessionError, refresh } = useSession();
  const [newCompanyName, setNewCompanyName] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [summary, setSummary] = useState<CompanySummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    if (activeMembership) {
      (async () => {
        try {
          setSummary(await api.companySummary());
        } catch (err) {
          setSummaryError(err instanceof ApiError ? err.message : "Failed to load overview.");
        }
      })();
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSummary(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleSwitch(companyId: number) {
    setWorking(true);
    try {
      await api.setActiveCompany(companyId);
      await refresh();
    } finally {
      setWorking(false);
    }
  }

  async function handleCreateCompany(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    try {
      const company = await api.createCompany({ name: newCompanyName });
      await api.setActiveCompany(company.id);
      setNewCompanyName("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create company.");
    } finally {
      setWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  return (
    <main style={{ maxWidth: 960, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <AppHeader activeMembership={activeMembership} />

      <section>
        <h2 style={{ fontSize: 16, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
          Your companies
        </h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {me.memberships.map((m) => (
            <button
              key={m.id}
              onClick={() => handleSwitch(m.company.id)}
              disabled={working}
              style={{
                padding: "10px 16px",
                border: m.company.id === me.active_company_id ? "2px solid #333" : "1px solid #ccc",
                background: m.company.id === me.active_company_id ? "#f5f5f5" : "white",
                cursor: "pointer",
              }}
            >
              {m.company.name}
              <div style={{ fontSize: 12, color: "#888" }}>{m.roles.map((r) => r.name).join(", ")}</div>
            </button>
          ))}
        </div>

        <form onSubmit={handleCreateCompany} style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <input
            placeholder="New company name"
            value={newCompanyName}
            onChange={(e) => setNewCompanyName(e.target.value)}
            style={{ padding: 8, flex: 1 }}
          />
          <button type="submit" disabled={working || !newCompanyName} style={{ padding: "8px 16px" }}>
            Create company
          </button>
        </form>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
      </section>

      {activeMembership ? (
        <>
          <section style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 16, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              {activeMembership.company.name} — overview
            </h2>
            {summaryError && <p style={{ color: "crimson" }}>{summaryError}</p>}
            {summary && Object.keys(summary).length === 0 && (
              <p style={{ color: "#999", fontSize: 13 }}>
                Nothing to show — your role doesn&apos;t have view access to any module with overview
                data yet.
              </p>
            )}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {summary?.finance && (
                <>
                  <StatCard label="Revenue" value={formatCents(summary.finance.revenue_cents)} />
                  <StatCard label="Expenses" value={formatCents(summary.finance.expense_cents)} />
                  <StatCard label="Profit" value={formatCents(summary.finance.profit_cents)} />
                  <StatCard
                    label="Pending receivable"
                    value={formatCents(summary.finance.pending_receivable_cents)}
                  />
                  <StatCard
                    label="Pending payable"
                    value={formatCents(summary.finance.pending_payable_cents)}
                  />
                </>
              )}
              {summary?.sales && (
                <>
                  <StatCard label="Sales orders" value={String(summary.sales.order_count)} />
                  <StatCard label="Sales value" value={formatCents(summary.sales.total_sales_cents)} />
                </>
              )}
              {summary?.inventory && (
                <>
                  <StatCard label="Items" value={String(summary.inventory.item_count)} />
                  <StatCard label="Stock units" value={String(summary.inventory.total_units)} />
                  <StatCard
                    label="Low stock alerts"
                    value={String(summary.inventory.low_stock_count)}
                    warn={summary.inventory.low_stock_count > 0}
                  />
                </>
              )}
              {summary?.hr && (
                <StatCard label="Employees" value={String(summary.hr.employee_count)} />
              )}
            </div>
          </section>

          <section style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 16, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              {activeMembership.company.name} — modules
            </h2>
            <style>{`
              .module-tile {
                transition: transform 0.15s ease, box-shadow 0.15s ease;
                box-shadow: 0 1px 3px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.05);
              }
              .module-tile.clickable:hover {
                transform: translateY(-3px);
                box-shadow: 0 8px 20px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06);
              }
            `}</style>
            <div
              style={{
                marginTop: 12,
                padding: 24,
                borderRadius: 20,
                background: "linear-gradient(135deg, #f3f0ff 0%, #eef4ff 50%, #fdf4ff 100%)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                  gap: 20,
                }}
              >
                {MODULE_TILES.map((tile) => {
                  const enabled = activeMembership.permissions.includes(tile.permission);
                  const clickable = enabled && tile.href;
                  const card = (
                    <div
                      className={`module-tile${clickable ? " clickable" : ""}`}
                      style={{
                        padding: "20px 12px",
                        borderRadius: 18,
                        background: "white",
                        cursor: clickable ? "pointer" : "default",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 10,
                        textAlign: "center",
                      }}
                      title={enabled ? undefined : `Requires ${tile.permission}`}
                    >
                      <ModuleIcon moduleKey={tile.key} muted={!enabled} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: enabled ? "#222" : "#999" }}>
                          {tile.label}
                        </div>
                        <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                          {enabled ? "" : "No access"}
                        </div>
                      </div>
                    </div>
                  );
                  return clickable ? (
                    <Link key={tile.key} href={tile.href!} style={{ display: "block" }}>
                      {card}
                    </Link>
                  ) : (
                    <div key={tile.key}>{card}</div>
                  );
                })}
              </div>
            </div>
            <p style={{ marginTop: 16, fontSize: 13, color: "#999" }}>
              Every module has a working screen now. See TODO.md.
            </p>
          </section>
        </>
      ) : (
        <p style={{ marginTop: 40, color: "#666" }}>
          Pick a company above to see its dashboard, or create a new one.
        </p>
      )}
    </main>
  );
}
