"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type Machine, type MachineMaintenanceLog, type WorkCenter } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const MACHINE_STATUS_LABELS: Record<Machine["status"], string> = {
  active: "Active",
  maintenance: "In maintenance",
  retired: "Retired",
};

const MACHINE_STATUS_BADGES: Record<Machine["status"], string> = {
  active: shared.badgeSuccess,
  maintenance: shared.badgeWarn,
  retired: "",
};

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function WorkCentersPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [workCenters, setWorkCenters] = useState<WorkCenter[] | null>(null);
  const [machines, setMachines] = useState<Machine[] | null>(null);
  const [logs, setLogs] = useState<MachineMaintenanceLog[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [wcForm, setWcForm] = useState({ name: "", code: "", hourly_rate_cents: "" });
  const [wcWorking, setWcWorking] = useState(false);
  const [wcError, setWcError] = useState<string | null>(null);

  const [machineForm, setMachineForm] = useState({ work_center: "", name: "", code: "" });
  const [machineWorking, setMachineWorking] = useState(false);
  const [machineError, setMachineError] = useState<string | null>(null);

  const [logForm, setLogForm] = useState({ machine: "", performed_at: "", description: "", cost_cents: "" });
  const [logWorking, setLogWorking] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [wc, m, l] = await Promise.all([
        api.listWorkCenters(),
        api.listMachines(),
        api.listMachineMaintenanceLogs(),
      ]);
      setWorkCenters(wc);
      setMachines(m);
      setLogs(l);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load work centers.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAddWorkCenter(e: React.FormEvent) {
    e.preventDefault();
    setWcWorking(true);
    setWcError(null);
    try {
      await api.createWorkCenter({
        name: wcForm.name,
        code: wcForm.code,
        hourly_rate_cents: Math.round(Number(wcForm.hourly_rate_cents || 0) * 100),
      });
      setWcForm({ name: "", code: "", hourly_rate_cents: "" });
      await loadAll();
    } catch (err) {
      setWcError(err instanceof ApiError ? err.message : "Failed to save work center.");
    } finally {
      setWcWorking(false);
    }
  }

  async function handleDeleteWorkCenter(id: number) {
    try {
      await api.deleteWorkCenter(id);
      await loadAll();
    } catch (err) {
      setWcError(err instanceof ApiError ? err.message : "Failed to delete work center.");
    }
  }

  async function handleAddMachine(e: React.FormEvent) {
    e.preventDefault();
    setMachineWorking(true);
    setMachineError(null);
    try {
      await api.createMachine({
        work_center: Number(machineForm.work_center),
        name: machineForm.name,
        code: machineForm.code,
      });
      setMachineForm({ work_center: "", name: "", code: "" });
      await loadAll();
    } catch (err) {
      setMachineError(err instanceof ApiError ? err.message : "Failed to save machine.");
    } finally {
      setMachineWorking(false);
    }
  }

  async function handleSetMachineStatus(m: Machine, status: Machine["status"]) {
    setMachineWorking(true);
    setMachineError(null);
    try {
      await api.updateMachine(m.id, { status });
      await loadAll();
    } catch (err) {
      setMachineError(err instanceof ApiError ? err.message : "Failed to update machine.");
    } finally {
      setMachineWorking(false);
    }
  }

  async function handleDeleteMachine(id: number) {
    try {
      await api.deleteMachine(id);
      await loadAll();
    } catch (err) {
      setMachineError(err instanceof ApiError ? err.message : "Failed to delete machine.");
    }
  }

  async function handleAddLog(e: React.FormEvent) {
    e.preventDefault();
    setLogWorking(true);
    setLogError(null);
    try {
      await api.createMachineMaintenanceLog({
        machine: Number(logForm.machine),
        performed_at: logForm.performed_at,
        description: logForm.description,
        cost_cents: Math.round(Number(logForm.cost_cents || 0) * 100),
      });
      setLogForm({ machine: "", performed_at: "", description: "", cost_cents: "" });
      await loadAll();
    } catch (err) {
      setLogError(err instanceof ApiError ? err.message : "Failed to log maintenance.");
    } finally {
      setLogWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("manufacturing.manage") ?? false;

  return (
    <ModuleShell moduleKey="manufacturing" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Work Centers & Machines</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Work centers</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Rate / hour</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {workCenters?.map((wc) => (
                  <tr key={wc.id}>
                    <td>{wc.name}</td>
                    <td className={shared.tableMuted}>{wc.code || "—"}</td>
                    <td className={shared.tableMuted}>{formatCents(wc.hourly_rate_cents)}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDeleteWorkCenter(wc.id)} disabled={wcWorking} />
                      </td>
                    )}
                  </tr>
                ))}
                {workCenters?.length === 0 && (
                  <tr>
                    <td colSpan={4} className={shared.tableMuted}>
                      No work centers yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddWorkCenter} className={shared.formRow} style={{ marginTop: 12 }}>
                <input
                  placeholder="Name (e.g. Assembly Line 1)"
                  required
                  value={wcForm.name}
                  onChange={(e) => setWcForm({ ...wcForm, name: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Code"
                  value={wcForm.code}
                  onChange={(e) => setWcForm({ ...wcForm, code: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 120 }}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Rate / hour"
                  value={wcForm.hourly_rate_cents}
                  onChange={(e) => setWcForm({ ...wcForm, hourly_rate_cents: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 120 }}
                />
                <button
                  type="submit"
                  disabled={wcWorking || !wcForm.name}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Add work center
                </button>
                {wcError && <p className={shared.errorText}>{wcError}</p>}
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Machines</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Work center</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {machines?.map((m) => (
                  <tr key={m.id}>
                    <td>{m.name}</td>
                    <td className={shared.tableMuted}>{m.work_center_name}</td>
                    <td>
                      {canManage ? (
                        <select
                          value={m.status}
                          onChange={(e) => handleSetMachineStatus(m, e.target.value as Machine["status"])}
                          disabled={machineWorking}
                          className={shared.select}
                        >
                          {Object.entries(MACHINE_STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`${shared.badge} ${MACHINE_STATUS_BADGES[m.status]}`}>
                          {MACHINE_STATUS_LABELS[m.status]}
                        </span>
                      )}
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDeleteMachine(m.id)} disabled={machineWorking} />
                      </td>
                    )}
                  </tr>
                ))}
                {machines?.length === 0 && (
                  <tr>
                    <td colSpan={4} className={shared.tableMuted}>
                      No machines yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddMachine} className={shared.formRow} style={{ marginTop: 12 }}>
                <select
                  required
                  value={machineForm.work_center}
                  onChange={(e) => setMachineForm({ ...machineForm, work_center: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Work center…</option>
                  {workCenters?.map((wc) => (
                    <option key={wc.id} value={wc.id}>
                      {wc.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Machine name"
                  required
                  value={machineForm.name}
                  onChange={(e) => setMachineForm({ ...machineForm, name: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Code"
                  value={machineForm.code}
                  onChange={(e) => setMachineForm({ ...machineForm, code: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 120 }}
                />
                <button
                  type="submit"
                  disabled={machineWorking || !machineForm.work_center || !machineForm.name}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Add machine
                </button>
                {machineError && <p className={shared.errorText}>{machineError}</p>}
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Maintenance log</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Machine</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {logs?.map((l) => (
                  <tr key={l.id}>
                    <td>{l.machine_name}</td>
                    <td className={shared.tableMuted}>{l.performed_at}</td>
                    <td className={shared.tableMuted}>{l.description}</td>
                    <td className={shared.tableMuted}>{formatCents(l.cost_cents)}</td>
                  </tr>
                ))}
                {logs?.length === 0 && (
                  <tr>
                    <td colSpan={4} className={shared.tableMuted}>
                      No maintenance logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddLog} className={shared.formRow} style={{ marginTop: 12 }}>
                <select
                  required
                  value={logForm.machine}
                  onChange={(e) => setLogForm({ ...logForm, machine: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Machine…</option>
                  {machines?.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  required
                  value={logForm.performed_at}
                  onChange={(e) => setLogForm({ ...logForm, performed_at: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Description"
                  required
                  value={logForm.description}
                  onChange={(e) => setLogForm({ ...logForm, description: e.target.value })}
                  className={shared.input}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Cost"
                  value={logForm.cost_cents}
                  onChange={(e) => setLogForm({ ...logForm, cost_cents: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 100 }}
                />
                <button
                  type="submit"
                  disabled={logWorking || !logForm.machine || !logForm.performed_at || !logForm.description}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Log maintenance
                </button>
                {logError && <p className={shared.errorText}>{logError}</p>}
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
