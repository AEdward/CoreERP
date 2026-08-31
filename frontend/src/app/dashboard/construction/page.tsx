"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type ConstructionProject, type Customer, type Employee } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const STATUS_BADGES: Record<ConstructionProject["status"], string> = {
  planning: shared.badgeInfo,
  in_progress: shared.badgeWarn,
  on_hold: shared.badgeDanger,
  completed: shared.badgeSuccess,
  cancelled: shared.badgeDanger,
};

export default function ConstructionProjectsPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [projects, setProjects] = useState<ConstructionProject[] | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    name: "",
    client: "",
    site_address: "",
    site_manager: "",
    start_date: "",
    end_date: "",
    notes: "",
  });

  async function load() {
    try {
      const [p, c, e] = await Promise.all([
        api.listConstructionProjects(),
        api.listCustomers(),
        api.listEmployees(),
      ]);
      setProjects(p);
      setCustomers(c);
      setEmployees(e);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load projects.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setActionError(null);
    try {
      await api.createConstructionProject({
        name: form.name,
        client: form.client ? Number(form.client) : null,
        site_address: form.site_address,
        site_manager: form.site_manager ? Number(form.site_manager) : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes,
      });
      setForm({ name: "", client: "", site_address: "", site_manager: "", start_date: "", end_date: "", notes: "" });
      setShowForm(false);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save project.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteConstructionProject(id);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete project.");
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("construction.manage") ?? false;

  return (
    <ModuleShell moduleKey="construction" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Projects</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
          {canManage && (
            <div className={shared.pageActions}>
              <button type="button" onClick={() => setShowForm((v) => !v)} className={`${shared.btn} ${shared.btnPrimary}`}>
                {showForm ? "Cancel" : "New project"}
              </button>
            </div>
          )}
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}
        {actionError && <p className={shared.errorText}>{actionError}</p>}

        {canManage && showForm && (
          <div className={shared.section}>
            <div className={shared.card}>
              <form onSubmit={handleAdd}>
                <div className={shared.formGrid}>
                  <div className={shared.field}>
                    <label className={shared.label}>Name</label>
                    <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={shared.input} />
                  </div>
                  <div className={shared.field}>
                    <label className={shared.label}>Client</label>
                    <select value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} className={shared.select}>
                      <option value="">—</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={shared.field}>
                    <label className={shared.label}>Site manager</label>
                    <select value={form.site_manager} onChange={(e) => setForm({ ...form, site_manager: e.target.value })} className={shared.select}>
                      <option value="">—</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={shared.field}>
                    <label className={shared.label}>Site address</label>
                    <input value={form.site_address} onChange={(e) => setForm({ ...form, site_address: e.target.value })} className={shared.input} />
                  </div>
                  <div className={shared.field}>
                    <label className={shared.label}>Start date</label>
                    <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={shared.input} />
                  </div>
                  <div className={shared.field}>
                    <label className={shared.label}>End date</label>
                    <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={shared.input} />
                  </div>
                  <div className={shared.field}>
                    <label className={shared.label}>Notes</label>
                    <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={shared.input} />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <button type="submit" disabled={working || !form.name} className={`${shared.btn} ${shared.btnPrimary}`}>
                    Save project
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className={shared.section}>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Client</th>
                  <th>Site manager</th>
                  <th>Budget</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {projects?.map((p) => (
                  <tr key={p.id}>
                    <td>{p.number}</td>
                    <td>
                      <Link href={`/dashboard/construction/${p.id}`}>{p.name}</Link>
                    </td>
                    <td className={shared.tableMuted}>{p.client_name || "—"}</td>
                    <td className={shared.tableMuted}>{p.site_manager_name || "—"}</td>
                    <td className={shared.tableMuted}>{formatCents(p.budget_cents)}</td>
                    <td>
                      <span className={`${shared.badge} ${STATUS_BADGES[p.status]}`}>{p.status.replace("_", " ")}</span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDelete(p.id)} disabled={working} />
                      </td>
                    )}
                  </tr>
                ))}
                {projects?.length === 0 && (
                  <tr>
                    <td colSpan={7} className={shared.tableMuted}>
                      No projects yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
