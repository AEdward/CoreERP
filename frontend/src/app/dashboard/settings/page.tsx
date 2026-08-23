"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type Branch, type Company } from "@/lib/api";
import { useSession } from "@/lib/useSession";

const EMPTY_BRANCH_FORM = { name: "", code: "", address: "", phone: "", is_active: true };

export default function SettingsPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [company, setCompany] = useState<Company | null>(null);
  const [companyForm, setCompanyForm] = useState<Partial<Company>>({});
  const [companyWorking, setCompanyWorking] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [companySaved, setCompanySaved] = useState(false);

  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [branchForm, setBranchForm] = useState(EMPTY_BRANCH_FORM);
  const [branchWorking, setBranchWorking] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [editingBranchId, setEditingBranchId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [c, b] = await Promise.all([api.listCompanies(), api.listBranches()]);
      const current = c.find((x) => x.id === activeMembership?.company.id) ?? null;
      setCompany(current);
      if (current) {
        setCompanyForm({
          name: current.name,
          industry: current.industry,
          country: current.country,
          currency: current.currency,
          timezone: current.timezone,
          tax_number: current.tax_number,
          address: current.address,
          phone: current.phone,
          email: current.email,
        });
      }
      setBranches(b);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load settings.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleSaveCompany(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;
    setCompanyWorking(true);
    setCompanyError(null);
    setCompanySaved(false);
    try {
      await api.updateCompany(company.id, companyForm);
      setCompanySaved(true);
      await loadAll();
    } catch (err) {
      setCompanyError(err instanceof ApiError ? err.message : "Failed to save company profile.");
    } finally {
      setCompanyWorking(false);
    }
  }

  async function handleAddBranch(e: React.FormEvent) {
    e.preventDefault();
    setBranchWorking(true);
    setBranchError(null);
    try {
      if (editingBranchId) {
        await api.updateBranch(editingBranchId, branchForm);
      } else {
        await api.createBranch(branchForm);
      }
      setBranchForm(EMPTY_BRANCH_FORM);
      setEditingBranchId(null);
      await loadAll();
    } catch (err) {
      setBranchError(err instanceof ApiError ? err.message : "Failed to save branch.");
    } finally {
      setBranchWorking(false);
    }
  }

  function startEditBranch(b: Branch) {
    setEditingBranchId(b.id);
    setBranchForm({
      name: b.name,
      code: b.code,
      address: b.address,
      phone: b.phone,
      is_active: b.is_active,
    });
  }

  async function handleDeleteBranch(id: number) {
    try {
      await api.deleteBranch(id);
      await loadAll();
    } catch (err) {
      setBranchError(err instanceof ApiError ? err.message : "Failed to delete branch.");
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("settings.manage") ?? false;

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <AppHeader activeMembership={activeMembership} />

      {!activeMembership ? (
        <p style={{ color: "#666" }}>
          Pick an active company on the <a href="/dashboard">dashboard</a> first.
        </p>
      ) : (
        <>
          <h1 style={{ fontSize: 20 }}>Settings — {activeMembership.company.name}</h1>
          {loadError && <p style={{ color: "crimson" }}>{loadError}</p>}

          {/* Company profile */}
          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Company profile
            </h2>
            {!canManage && (
              <p style={{ fontSize: 13, color: "#999" }}>Only an Owner can edit these fields.</p>
            )}
            <form
              onSubmit={handleSaveCompany}
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 8,
                maxWidth: 760,
              }}
            >
              <input
                placeholder="Name"
                disabled={!canManage}
                value={companyForm.name ?? ""}
                onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                style={{ padding: 8 }}
              />
              <input
                placeholder="Industry"
                disabled={!canManage}
                value={companyForm.industry ?? ""}
                onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
                style={{ padding: 8 }}
              />
              <input
                placeholder="Country"
                disabled={!canManage}
                value={companyForm.country ?? ""}
                onChange={(e) => setCompanyForm({ ...companyForm, country: e.target.value })}
                style={{ padding: 8 }}
              />
              <input
                placeholder="Currency (e.g. USD)"
                disabled={!canManage}
                value={companyForm.currency ?? ""}
                onChange={(e) => setCompanyForm({ ...companyForm, currency: e.target.value })}
                style={{ padding: 8 }}
              />
              <input
                placeholder="Timezone"
                disabled={!canManage}
                value={companyForm.timezone ?? ""}
                onChange={(e) => setCompanyForm({ ...companyForm, timezone: e.target.value })}
                style={{ padding: 8 }}
              />
              <input
                placeholder="Tax number"
                disabled={!canManage}
                value={companyForm.tax_number ?? ""}
                onChange={(e) => setCompanyForm({ ...companyForm, tax_number: e.target.value })}
                style={{ padding: 8 }}
              />
              <input
                placeholder="Address"
                disabled={!canManage}
                value={companyForm.address ?? ""}
                onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                style={{ padding: 8 }}
              />
              <input
                placeholder="Phone"
                disabled={!canManage}
                value={companyForm.phone ?? ""}
                onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                style={{ padding: 8 }}
              />
              <input
                placeholder="Email"
                type="email"
                disabled={!canManage}
                value={companyForm.email ?? ""}
                onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                style={{ padding: 8 }}
              />
              {canManage && (
                <button
                  type="submit"
                  disabled={companyWorking}
                  style={{ padding: "8px 16px", gridColumn: "1 / -1", justifySelf: "start" }}
                >
                  Save company profile
                </button>
              )}
              {companySaved && (
                <p style={{ color: "green", gridColumn: "1 / -1", margin: 0, fontSize: 13 }}>Saved.</p>
              )}
              {companyError && (
                <p style={{ color: "crimson", gridColumn: "1 / -1", margin: 0 }}>{companyError}</p>
              )}
            </form>
          </section>

          {/* Branches */}
          <section style={{ marginTop: 40, marginBottom: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Branches
            </h2>
            <p style={{ fontSize: 12, color: "#999", margin: "4px 0 8px" }}>
              Physical locations this company operates from. Employees, departments, and warehouses
              can each optionally be assigned to one.
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Name</th>
                  <th style={{ padding: "6px 4px" }}>Code</th>
                  <th style={{ padding: "6px 4px" }}>Address</th>
                  <th style={{ padding: "6px 4px" }}>Phone</th>
                  <th style={{ padding: "6px 4px" }}>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {branches?.map((b) => (
                  <tr key={b.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{b.name}</td>
                    <td style={{ padding: "6px 4px" }}>{b.code || "—"}</td>
                    <td style={{ padding: "6px 4px" }}>{b.address || "—"}</td>
                    <td style={{ padding: "6px 4px" }}>{b.phone || "—"}</td>
                    <td style={{ padding: "6px 4px" }}>{b.is_active ? "Active" : "Inactive"}</td>
                    {canManage && (
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
                        <RowActions
                          onEdit={() => startEditBranch(b)}
                          onDelete={() => handleDeleteBranch(b.id)}
                          disabled={branchWorking}
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {branches?.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "6px 4px", color: "#999" }}>
                      No branches yet — everything is treated as a single location.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form
                onSubmit={handleAddBranch}
                style={{
                  marginTop: 16,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 8,
                  maxWidth: 720,
                }}
              >
                <input
                  placeholder="Name"
                  required
                  value={branchForm.name}
                  onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Code (optional)"
                  value={branchForm.code}
                  onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Address"
                  value={branchForm.address}
                  onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Phone"
                  value={branchForm.phone}
                  onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                  style={{ padding: 8 }}
                />
                <label style={{ display: "flex", alignItems: "center", gap: 6, padding: 8 }}>
                  <input
                    type="checkbox"
                    checked={branchForm.is_active}
                    onChange={(e) => setBranchForm({ ...branchForm, is_active: e.target.checked })}
                  />
                  Active
                </label>
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                  <button
                    type="submit"
                    disabled={branchWorking || !branchForm.name}
                    style={{ padding: "8px 16px" }}
                  >
                    {editingBranchId ? "Save changes" : "Add branch"}
                  </button>
                  {editingBranchId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBranchId(null);
                        setBranchForm(EMPTY_BRANCH_FORM);
                      }}
                      style={{ padding: "8px 16px" }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {branchError && (
                  <p style={{ color: "crimson", gridColumn: "1 / -1", margin: 0 }}>{branchError}</p>
                )}
              </form>
            )}
          </section>

          {/* Audit log */}
          {canManage && (
            <section style={{ marginTop: 40 }}>
              <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
                Compliance
              </h2>
              <a href="/dashboard/audit-log" style={{ fontSize: 13 }}>
                View the company-wide audit log →
              </a>
            </section>
          )}
        </>
      )}
    </main>
  );
}
