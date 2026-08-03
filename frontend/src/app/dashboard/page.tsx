"use client";

import { useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { api, ApiError } from "@/lib/api";
import { useSession } from "@/lib/useSession";

const MODULE_TILES = [
  { key: "settings", label: "Settings", permission: "settings.manage" },
  { key: "accounting", label: "Accounting", permission: "accounting.view" },
  { key: "hr", label: "HR", permission: "hr.view", href: "/dashboard/hr" },
  { key: "sales", label: "Sales & CRM", permission: "sales.view" },
  {
    key: "inventory",
    label: "Inventory & Catalog",
    permission: "inventory.view",
    href: "/dashboard/inventory",
  },
  { key: "procurement", label: "Procurement", permission: "procurement.view" },
];

export default function DashboardPage() {
  const { me, activeMembership, error: sessionError, refresh } = useSession();
  const [newCompanyName, setNewCompanyName] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <main style={{ maxWidth: 720, margin: "40px auto", fontFamily: "sans-serif" }}>
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
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 16, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
            {activeMembership.company.name} — modules
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {MODULE_TILES.map((tile) => {
              const enabled = activeMembership.permissions.includes(tile.permission);
              const clickable = enabled && tile.href;
              const card = (
                <div
                  style={{
                    padding: 20,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    opacity: enabled ? 1 : 0.4,
                    background: enabled ? "white" : "#fafafa",
                    cursor: clickable ? "pointer" : "default",
                  }}
                  title={enabled ? undefined : `Requires ${tile.permission}`}
                >
                  <strong>{tile.label}</strong>
                  <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                    {enabled ? (tile.href ? "Open →" : "Available") : "No access"}
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
          <p style={{ marginTop: 16, fontSize: 13, color: "#999" }}>
            HR and Inventory & Catalog have working screens now. The rest still only have live APIs
            behind them — see TODO.md.
          </p>
        </section>
      ) : (
        <p style={{ marginTop: 40, color: "#666" }}>
          Pick a company above to see its dashboard, or create a new one.
        </p>
      )}
    </main>
  );
}
