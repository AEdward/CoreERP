"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type Me } from "@/lib/api";

const MODULE_TILES = [
  { key: "settings", label: "Settings", permission: "settings.manage" },
  { key: "accounting", label: "Accounting", permission: "accounting.view" },
  { key: "hr", label: "HR", permission: "hr.view" },
  { key: "sales", label: "Sales & CRM", permission: "sales.view" },
  { key: "inventory", label: "Inventory", permission: "inventory.view" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [working, setWorking] = useState(false);

  async function refresh() {
    try {
      const data = await api.me();
      setMe(data);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        router.push("/login");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Failed to load dashboard.");
    }
  }

  useEffect(() => {
    // Session-cookie auth means this has to be a client-side fetch on
    // mount, not a server component — there's no session to read on the
    // server without forwarding cookies manually.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // refresh() is stable enough for a mount-only fetch; omitting it from
    // deps avoids re-fetching on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function handleLogout() {
    await api.logout();
    router.push("/login");
  }

  if (error) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{error}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const activeMembership = me.memberships.find((m) => m.company.id === me.active_company_id);

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", fontFamily: "sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>CoreERP</h1>
          <p style={{ color: "#666", margin: "4px 0 0" }}>Signed in as {me.user.full_name}</p>
        </div>
        <button onClick={handleLogout} style={{ padding: "8px 16px" }}>
          Log out
        </button>
      </header>

      <section style={{ marginTop: 32 }}>
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
      </section>

      {activeMembership ? (
        <section style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 16, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
            {activeMembership.company.name} — modules
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {MODULE_TILES.map((tile) => {
              const enabled = activeMembership.permissions.includes(tile.permission);
              return (
                <div
                  key={tile.key}
                  style={{
                    padding: 20,
                    border: "1px solid #ddd",
                    borderRadius: 8,
                    opacity: enabled ? 1 : 0.4,
                    background: enabled ? "white" : "#fafafa",
                  }}
                  title={enabled ? undefined : `Requires ${tile.permission}`}
                >
                  <strong>{tile.label}</strong>
                  <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                    {enabled ? "Available" : "No access"}
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ marginTop: 16, fontSize: 13, color: "#999" }}>
            Modules are empty for now — Phase 1 (Foundation) only proves auth, company context, and
            role-based access. See TODO.md for what&apos;s next.
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
