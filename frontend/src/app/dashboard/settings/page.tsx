"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type Branch, type Company, type TaxRate } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const EMPTY_BRANCH_FORM = { name: "", code: "", address: "", phone: "", is_active: true };
const EMPTY_TAX_RATE_FORM = { name: "", code: "", rate_percent: "", is_default: false, is_active: true };

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

  const [taxRates, setTaxRates] = useState<TaxRate[] | null>(null);
  const [taxRateForm, setTaxRateForm] = useState(EMPTY_TAX_RATE_FORM);
  const [taxRateWorking, setTaxRateWorking] = useState(false);
  const [taxRateError, setTaxRateError] = useState<string | null>(null);
  const [editingTaxRateId, setEditingTaxRateId] = useState<number | null>(null);

  async function loadAll() {
    try {
      const [c, b, t] = await Promise.all([api.listCompanies(), api.listBranches(), api.listTaxRates()]);
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
      setTaxRates(t);
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

  async function handleAddTaxRate(e: React.FormEvent) {
    e.preventDefault();
    setTaxRateWorking(true);
    setTaxRateError(null);
    try {
      const payload = { ...taxRateForm, rate_percent: taxRateForm.rate_percent || "0" };
      if (editingTaxRateId) {
        await api.updateTaxRate(editingTaxRateId, payload);
      } else {
        await api.createTaxRate(payload);
      }
      setTaxRateForm(EMPTY_TAX_RATE_FORM);
      setEditingTaxRateId(null);
      await loadAll();
    } catch (err) {
      setTaxRateError(err instanceof ApiError ? err.message : "Failed to save tax rate.");
    } finally {
      setTaxRateWorking(false);
    }
  }

  function startEditTaxRate(t: TaxRate) {
    setEditingTaxRateId(t.id);
    setTaxRateForm({
      name: t.name,
      code: t.code,
      rate_percent: t.rate_percent,
      is_default: t.is_default,
      is_active: t.is_active,
    });
  }

  async function handleDeleteTaxRate(id: number) {
    try {
      await api.deleteTaxRate(id);
      await loadAll();
    } catch (err) {
      setTaxRateError(err instanceof ApiError ? err.message : "Failed to delete tax rate.");
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("settings.manage") ?? false;

  return (
    <ModuleShell moduleKey="settings" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Settings</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        {/* Company profile */}
        <div className={shared.card} style={{ marginBottom: 24 }}>
          <h2 className={shared.sectionTitle}>Company profile</h2>
          {!canManage && <p className={shared.hint}>Only an Owner can edit these fields.</p>}
          <form onSubmit={handleSaveCompany} className={shared.formGrid} style={{ marginTop: 12 }}>
            <input
              placeholder="Name"
              disabled={!canManage}
              value={companyForm.name ?? ""}
              onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
              className={shared.input}
            />
            <input
              placeholder="Industry"
              disabled={!canManage}
              value={companyForm.industry ?? ""}
              onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })}
              className={shared.input}
            />
            <input
              placeholder="Country"
              disabled={!canManage}
              value={companyForm.country ?? ""}
              onChange={(e) => setCompanyForm({ ...companyForm, country: e.target.value })}
              className={shared.input}
            />
            <input
              placeholder="Currency (e.g. USD)"
              disabled={!canManage}
              value={companyForm.currency ?? ""}
              onChange={(e) => setCompanyForm({ ...companyForm, currency: e.target.value })}
              className={shared.input}
            />
            <input
              placeholder="Timezone"
              disabled={!canManage}
              value={companyForm.timezone ?? ""}
              onChange={(e) => setCompanyForm({ ...companyForm, timezone: e.target.value })}
              className={shared.input}
            />
            <input
              placeholder="Tax number"
              disabled={!canManage}
              value={companyForm.tax_number ?? ""}
              onChange={(e) => setCompanyForm({ ...companyForm, tax_number: e.target.value })}
              className={shared.input}
            />
            <input
              placeholder="Address"
              disabled={!canManage}
              value={companyForm.address ?? ""}
              onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
              className={shared.input}
            />
            <input
              placeholder="Phone"
              disabled={!canManage}
              value={companyForm.phone ?? ""}
              onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
              className={shared.input}
            />
            <input
              placeholder="Email"
              type="email"
              disabled={!canManage}
              value={companyForm.email ?? ""}
              onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
              className={shared.input}
            />
            {canManage && (
              <button
                type="submit"
                disabled={companyWorking}
                className={`${shared.btn} ${shared.btnPrimary}`}
                style={{ gridColumn: "1 / -1", justifySelf: "start" }}
              >
                Save company profile
              </button>
            )}
            {companySaved && (
              <p
                className={`${shared.badge} ${shared.badgeSuccess}`}
                style={{ gridColumn: "1 / -1", margin: 0, justifySelf: "start" }}
              >
                Saved
              </p>
            )}
            {companyError && (
              <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                {companyError}
              </p>
            )}
          </form>
        </div>

        {/* Branches */}
        <div className={shared.card} style={{ marginBottom: 24 }}>
          <h2 className={shared.sectionTitle}>Branches</h2>
          <p className={shared.hint} style={{ marginBottom: 8 }}>
            Physical locations this company operates from. Employees, departments, and warehouses
            can each optionally be assigned to one.
          </p>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Address</th>
                <th>Phone</th>
                <th>Status</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {branches?.map((b) => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td>{b.code || "—"}</td>
                  <td>{b.address || "—"}</td>
                  <td>{b.phone || "—"}</td>
                  <td>
                    <span
                      className={`${shared.badge} ${b.is_active ? shared.badgeSuccess : shared.badgeInfo}`}
                    >
                      {b.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {canManage && (
                    <td style={{ textAlign: "right" }}>
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
                  <td colSpan={6} className={shared.tableMuted}>
                    No branches yet — everything is treated as a single location.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {canManage && (
            <form onSubmit={handleAddBranch} className={shared.formGrid} style={{ marginTop: 16 }}>
              <input
                placeholder="Name"
                required
                value={branchForm.name}
                onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                className={shared.input}
              />
              <input
                placeholder="Code (optional)"
                value={branchForm.code}
                onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value })}
                className={shared.input}
              />
              <input
                placeholder="Address"
                value={branchForm.address}
                onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                className={shared.input}
              />
              <input
                placeholder="Phone"
                value={branchForm.phone}
                onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                className={shared.input}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
                  className={`${shared.btn} ${shared.btnPrimary}`}
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
                    className={shared.btn}
                  >
                    Cancel
                  </button>
                )}
              </div>
              {branchError && (
                <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                  {branchError}
                </p>
              )}
            </form>
          )}
        </div>

        {/* Tax rates */}
        <div className={shared.card} style={{ marginBottom: 24 }}>
          <h2 className={shared.sectionTitle}>Tax rates</h2>
          <p className={shared.hint} style={{ marginBottom: 8 }}>
            Configured rates an Item can be assigned. Sales/Procurement automatically total tax from
            whichever rate each line&apos;s item carries — nothing is applied company-wide.
          </p>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Code</th>
                <th>Rate</th>
                <th>Default</th>
                <th>Status</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {taxRates?.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.code}</td>
                  <td>{t.rate_percent}%</td>
                  <td>{t.is_default ? "Yes" : "—"}</td>
                  <td>
                    <span
                      className={`${shared.badge} ${t.is_active ? shared.badgeSuccess : shared.badgeInfo}`}
                    >
                      {t.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {canManage && (
                    <td style={{ textAlign: "right" }}>
                      <RowActions
                        onEdit={() => startEditTaxRate(t)}
                        onDelete={() => handleDeleteTaxRate(t.id)}
                        disabled={taxRateWorking}
                      />
                    </td>
                  )}
                </tr>
              ))}
              {taxRates?.length === 0 && (
                <tr>
                  <td colSpan={6} className={shared.tableMuted}>
                    No tax rates yet — items with no rate assigned contribute zero tax.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {canManage && (
            <form onSubmit={handleAddTaxRate} className={shared.formGrid} style={{ marginTop: 16 }}>
              <input
                placeholder="Name (e.g. VAT)"
                required
                value={taxRateForm.name}
                onChange={(e) => setTaxRateForm({ ...taxRateForm, name: e.target.value })}
                className={shared.input}
              />
              <input
                placeholder="Code (e.g. VAT)"
                required
                value={taxRateForm.code}
                onChange={(e) => setTaxRateForm({ ...taxRateForm, code: e.target.value })}
                className={shared.input}
              />
              <input
                placeholder="Rate %"
                type="number"
                step="0.01"
                required
                value={taxRateForm.rate_percent}
                onChange={(e) => setTaxRateForm({ ...taxRateForm, rate_percent: e.target.value })}
                className={shared.input}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={taxRateForm.is_default}
                  onChange={(e) => setTaxRateForm({ ...taxRateForm, is_default: e.target.checked })}
                />
                Default for new items
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={taxRateForm.is_active}
                  onChange={(e) => setTaxRateForm({ ...taxRateForm, is_active: e.target.checked })}
                />
                Active
              </label>
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                <button
                  type="submit"
                  disabled={taxRateWorking || !taxRateForm.name || !taxRateForm.code}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  {editingTaxRateId ? "Save changes" : "Add tax rate"}
                </button>
                {editingTaxRateId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTaxRateId(null);
                      setTaxRateForm(EMPTY_TAX_RATE_FORM);
                    }}
                    className={shared.btn}
                  >
                    Cancel
                  </button>
                )}
              </div>
              {taxRateError && (
                <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                  {taxRateError}
                </p>
              )}
            </form>
          )}
        </div>

        {/* Audit log */}
        {canManage && (
          <div className={shared.card}>
            <h2 className={shared.sectionTitle}>Compliance</h2>
            <a href="/dashboard/audit-log" className={`${shared.btn}`} style={{ textDecoration: "none" }}>
              View the company-wide audit log →
            </a>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
