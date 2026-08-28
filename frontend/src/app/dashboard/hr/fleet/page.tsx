"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import {
  api,
  ApiError,
  type EmployeePickerEntry,
  type Vehicle,
  type VehicleAssignment,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const STATUS_LABELS: Record<Vehicle["status"], string> = {
  active: "Active",
  maintenance: "In maintenance",
  retired: "Retired",
};

const STATUS_BADGES: Record<Vehicle["status"], string> = {
  active: shared.badgeSuccess,
  maintenance: shared.badgeWarn,
  retired: "",
};

const EMPTY_VEHICLE_FORM = { registration_number: "", make: "", model: "", year: "" };
const EMPTY_ASSIGN_FORM = { vehicle: "", employee: "", start_date: "" };

export default function FleetPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [assignments, setAssignments] = useState<VehicleAssignment[] | null>(null);
  const [employees, setEmployees] = useState<EmployeePickerEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [vehicleForm, setVehicleForm] = useState(EMPTY_VEHICLE_FORM);
  const [vehicleWorking, setVehicleWorking] = useState(false);
  const [vehicleError, setVehicleError] = useState<string | null>(null);

  const [assignForm, setAssignForm] = useState(EMPTY_ASSIGN_FORM);
  const [assignWorking, setAssignWorking] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [v, a, emp] = await Promise.all([
        api.listVehicles(),
        api.listVehicleAssignments(),
        api.listEmployeePicker(),
      ]);
      setVehicles(v);
      setAssignments(a);
      setEmployees(emp);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load fleet data.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAddVehicle(e: React.FormEvent) {
    e.preventDefault();
    setVehicleWorking(true);
    setVehicleError(null);
    try {
      await api.createVehicle({
        registration_number: vehicleForm.registration_number,
        make: vehicleForm.make,
        model: vehicleForm.model,
        year: vehicleForm.year ? Number(vehicleForm.year) : null,
      });
      setVehicleForm(EMPTY_VEHICLE_FORM);
      await loadAll();
    } catch (err) {
      setVehicleError(err instanceof ApiError ? err.message : "Failed to save vehicle.");
    } finally {
      setVehicleWorking(false);
    }
  }

  async function handleSetVehicleStatus(v: Vehicle, status: Vehicle["status"]) {
    setVehicleWorking(true);
    setVehicleError(null);
    try {
      await api.updateVehicle(v.id, { status });
      await loadAll();
    } catch (err) {
      setVehicleError(err instanceof ApiError ? err.message : "Failed to update vehicle status.");
    } finally {
      setVehicleWorking(false);
    }
  }

  async function handleDeleteVehicle(id: number) {
    try {
      await api.deleteVehicle(id);
      await loadAll();
    } catch (err) {
      setVehicleError(err instanceof ApiError ? err.message : "Failed to delete vehicle.");
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    setAssignWorking(true);
    setAssignError(null);
    try {
      await api.createVehicleAssignment({
        vehicle: Number(assignForm.vehicle),
        employee: Number(assignForm.employee),
        start_date: assignForm.start_date,
      });
      setAssignForm(EMPTY_ASSIGN_FORM);
      await loadAll();
    } catch (err) {
      setAssignError(err instanceof ApiError ? err.message : "Failed to assign vehicle.");
    } finally {
      setAssignWorking(false);
    }
  }

  async function handleEndAssignment(id: number) {
    setAssignWorking(true);
    setAssignError(null);
    try {
      await api.endVehicleAssignment(id);
      await loadAll();
    } catch (err) {
      setAssignError(err instanceof ApiError ? err.message : "Failed to end assignment.");
    } finally {
      setAssignWorking(false);
    }
  }

  async function handleDeleteAssignment(id: number) {
    try {
      await api.deleteVehicleAssignment(id);
      await loadAll();
    } catch (err) {
      setAssignError(err instanceof ApiError ? err.message : "Failed to delete assignment.");
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hr.manage") ?? false;

  return (
    <ModuleShell moduleKey="hr" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Fleet</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
            <p className={shared.hint} style={{ marginTop: 4 }}>
              <a href="/dashboard/hr">&larr; Back to HR</a>
            </p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Vehicles</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Registration</th>
                  <th>Make / Model</th>
                  <th>Year</th>
                  <th>Status</th>
                  <th>Assigned to</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {vehicles?.map((v) => (
                  <tr key={v.id}>
                    <td>{v.registration_number}</td>
                    <td className={shared.tableMuted}>
                      {[v.make, v.model].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className={shared.tableMuted}>{v.year ?? "—"}</td>
                    <td>
                      {canManage ? (
                        <select
                          value={v.status}
                          onChange={(e) => handleSetVehicleStatus(v, e.target.value as Vehicle["status"])}
                          disabled={vehicleWorking}
                          className={shared.select}
                        >
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={`${shared.badge} ${STATUS_BADGES[v.status]}`}>
                          {STATUS_LABELS[v.status]}
                        </span>
                      )}
                    </td>
                    <td className={shared.tableMuted}>{v.current_assignee_name || "Unassigned"}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDeleteVehicle(v.id)} disabled={vehicleWorking} />
                      </td>
                    )}
                  </tr>
                ))}
                {vehicles?.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      No vehicles yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddVehicle} className={shared.formRow} style={{ marginTop: 12 }}>
                <input
                  placeholder="Registration number"
                  required
                  value={vehicleForm.registration_number}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, registration_number: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 180 }}
                />
                <input
                  placeholder="Make"
                  value={vehicleForm.make}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, make: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 120 }}
                />
                <input
                  placeholder="Model"
                  value={vehicleForm.model}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 120 }}
                />
                <input
                  placeholder="Year"
                  type="number"
                  value={vehicleForm.year}
                  onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 100 }}
                />
                <button
                  type="submit"
                  disabled={vehicleWorking || !vehicleForm.registration_number}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Add vehicle
                </button>
                {vehicleError && <p className={shared.errorText}>{vehicleError}</p>}
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Assignments</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Employee</th>
                  <th>Start</th>
                  <th>End</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {assignments?.map((a) => (
                  <tr key={a.id}>
                    <td>{a.vehicle_registration}</td>
                    <td>{a.employee_name}</td>
                    <td>{a.start_date}</td>
                    <td className={shared.tableMuted}>{a.end_date ?? "Ongoing"}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        {!a.end_date && (
                          <button
                            type="button"
                            onClick={() => handleEndAssignment(a.id)}
                            disabled={assignWorking}
                            className={`${shared.btn} ${shared.btnSmall}`}
                            style={{ marginRight: 6 }}
                          >
                            End
                          </button>
                        )}
                        <RowActions onDelete={() => handleDeleteAssignment(a.id)} disabled={assignWorking} />
                      </td>
                    )}
                  </tr>
                ))}
                {assignments?.length === 0 && (
                  <tr>
                    <td colSpan={5} className={shared.tableMuted}>
                      No assignments yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAssign} className={shared.formRow} style={{ marginTop: 12 }}>
                <select
                  required
                  value={assignForm.vehicle}
                  onChange={(e) => setAssignForm({ ...assignForm, vehicle: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Vehicle…</option>
                  {vehicles?.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.registration_number}
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={assignForm.employee}
                  onChange={(e) => setAssignForm({ ...assignForm, employee: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Employee…</option>
                  {employees?.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  required
                  value={assignForm.start_date}
                  onChange={(e) => setAssignForm({ ...assignForm, start_date: e.target.value })}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={assignWorking || !assignForm.vehicle || !assignForm.employee || !assignForm.start_date}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Assign vehicle
                </button>
                {assignError && <p className={shared.errorText}>{assignError}</p>}
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
