"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type PropertyMaintenanceRequest, type PropertyUnit } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const PRIORITY_BADGES: Record<PropertyMaintenanceRequest["priority"], string> = {
  low: "",
  medium: shared.badgeInfo,
  high: shared.badgeWarn,
  urgent: shared.badgeDanger,
};

const STATUS_BADGES: Record<PropertyMaintenanceRequest["status"], string> = {
  open: shared.badgeWarn,
  in_progress: shared.badgeInfo,
  completed: shared.badgeSuccess,
  cancelled: "",
};

const EMPTY_FORM = { unit: "", title: "", description: "", priority: "medium" as PropertyMaintenanceRequest["priority"] };

export default function PropertyMaintenancePage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [requests, setRequests] = useState<PropertyMaintenanceRequest[] | null>(null);
  const [units, setUnits] = useState<PropertyUnit[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadAll() {
    try {
      const [r, u] = await Promise.all([api.listPropertyMaintenanceRequests(), api.listPropertyUnits()]);
      setRequests(r);
      setUnits(u);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load maintenance requests.");
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
      await api.createPropertyMaintenanceRequest({
        unit: Number(form.unit),
        title: form.title,
        description: form.description,
        priority: form.priority,
      });
      setForm(EMPTY_FORM);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save maintenance request.");
    } finally {
      setWorking(false);
    }
  }

  async function handleResolve(id: number) {
    setWorking(true);
    try {
      await api.resolvePropertyMaintenanceRequest(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to resolve request.");
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
            <h1 className={shared.pageTitle}>Maintenance</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.section}>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {requests?.map((r) => (
                  <tr key={r.id}>
                    <td>{r.unit_label}</td>
                    <td className={shared.tableMuted}>{r.title}</td>
                    <td>
                      <span className={`${shared.badge} ${PRIORITY_BADGES[r.priority]}`}>{r.priority}</span>
                    </td>
                    <td>
                      <span className={`${shared.badge} ${STATUS_BADGES[r.status]}`}>{r.status}</span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        {r.status !== "completed" && r.status !== "cancelled" && (
                          <button
                            type="button"
                            onClick={() => handleResolve(r.id)}
                            disabled={working}
                            className={`${shared.btn} ${shared.btnSmall}`}
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {requests?.length === 0 && (
                  <tr>
                    <td colSpan={5} className={shared.tableMuted}>
                      No maintenance requests yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleCreate} className={shared.formRow} style={{ marginTop: 12 }}>
                <select
                  required
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Unit…</option>
                  {units?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.building_name} — {u.unit_number}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Title"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={shared.input}
                />
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value as PropertyMaintenanceRequest["priority"] })}
                  className={shared.select}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <button
                  type="submit"
                  disabled={working || !form.unit || !form.title}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Log request
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
