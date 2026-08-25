"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type AttendanceRecord, type EmployeePickerEntry } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const STATUS_LABELS: Record<AttendanceRecord["status"], string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half day",
};

const STATUS_BADGES: Record<AttendanceRecord["status"], string> = {
  present: shared.badgeSuccess,
  absent: shared.badgeDanger,
  late: shared.badgeWarn,
  half_day: shared.badgeInfo,
};

const EMPTY_FORM = {
  employee: "",
  date: "",
  clock_in: "",
  clock_out: "",
  status: "present" as AttendanceRecord["status"],
  notes: "",
};

export default function AttendancePage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [records, setRecords] = useState<AttendanceRecord[] | null>(null);
  const [employees, setEmployees] = useState<EmployeePickerEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [importText, setImportText] = useState("");
  const [importWorking, setImportWorking] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  async function loadAll() {
    try {
      const [r, emp] = await Promise.all([api.listAttendance(), api.listEmployeePicker()]);
      setRecords(r);
      setEmployees(emp);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load attendance data.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setError(null);
    try {
      await api.createAttendance({
        employee: Number(form.employee),
        date: form.date,
        clock_in: form.clock_in || null,
        clock_out: form.clock_out || null,
        status: form.status,
        notes: form.notes,
      });
      setForm(EMPTY_FORM);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record attendance.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteAttendance(id);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete record.");
    }
  }

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    setImportWorking(true);
    setImportError(null);
    try {
      const parsed = JSON.parse(importText);
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array of records.");
      await api.importAttendance(parsed);
      setImportText("");
      setImportOpen(false);
      await loadAll();
    } catch (err) {
      setImportError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to import records."
      );
    } finally {
      setImportWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hr.manage") ?? false;
  const employeeName = (id: number) => employees?.find((e) => e.id === id)?.name ?? "—";

  return (
    <ModuleShell moduleKey="hr" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Attendance</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
            <p className={shared.hint} style={{ marginTop: 4 }}>
              <a href="/dashboard/hr">&larr; Back to HR</a>
            </p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.card}>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Clock in/out</th>
                <th>Worked</th>
                <th>Overtime</th>
                <th>Status</th>
                <th>Source</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {records?.map((r) => (
                <tr key={r.id}>
                  <td>{employeeName(r.employee)}</td>
                  <td>{r.date}</td>
                  <td>
                    {r.clock_in ?? "—"} – {r.clock_out ?? "—"}
                  </td>
                  <td>{r.worked_hours}h</td>
                  <td>{r.overtime_hours}h</td>
                  <td>
                    <span className={`${shared.badge} ${STATUS_BADGES[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className={shared.tableMuted}>
                    {r.source === "device_import" ? "Device" : "Manual"}
                  </td>
                  {canManage && (
                    <td style={{ textAlign: "right" }}>
                      <RowActions onDelete={() => handleDelete(r.id)} disabled={working} />
                    </td>
                  )}
                </tr>
              ))}
              {records?.length === 0 && (
                <tr>
                  <td colSpan={8} className={shared.tableMuted}>
                    No attendance records yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {canManage && (
            <form onSubmit={handleAdd} className={shared.formGrid} style={{ marginTop: 16 }}>
              <select
                required
                value={form.employee}
                onChange={(e) => setForm({ ...form, employee: e.target.value })}
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
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className={shared.input}
              />
              <input
                type="time"
                placeholder="Clock in"
                value={form.clock_in}
                onChange={(e) => setForm({ ...form, clock_in: e.target.value })}
                className={shared.input}
              />
              <input
                type="time"
                placeholder="Clock out"
                value={form.clock_out}
                onChange={(e) => setForm({ ...form, clock_out: e.target.value })}
                className={shared.input}
              />
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as AttendanceRecord["status"] })
                }
                className={shared.select}
              >
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="late">Late</option>
                <option value="half_day">Half day</option>
              </select>
              <input
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={shared.input}
                style={{ gridColumn: "1 / -1" }}
              />
              <button
                type="submit"
                disabled={working || !form.employee || !form.date}
                className={`${shared.btn} ${shared.btnPrimary}`}
              >
                Record attendance
              </button>
              {error && (
                <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                  {error}
                </p>
              )}
            </form>
          )}

          {canManage && (
            <div style={{ marginTop: 24 }}>
              <button
                type="button"
                onClick={() => setImportOpen(!importOpen)}
                className={`${shared.btn} ${shared.btnSmall}`}
              >
                {importOpen ? "Hide" : "Bulk import from device"}
              </button>
              {importOpen && (
                <form onSubmit={handleImport} style={{ marginTop: 8, maxWidth: 700 }}>
                  <p className={shared.hint}>
                    Paste a JSON array of records exported from a biometric attendance device,
                    e.g. <code>{`[{"employee": 1, "date": "2026-08-01", "clock_in": "08:00", "clock_out": "17:00"}]`}</code>
                  </p>
                  <textarea
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    rows={6}
                    className={shared.textarea}
                    style={{ width: "100%", fontFamily: "monospace" }}
                  />
                  <button
                    type="submit"
                    disabled={importWorking || !importText}
                    className={`${shared.btn} ${shared.btnPrimary}`}
                    style={{ marginTop: 8 }}
                  >
                    Import
                  </button>
                  {importError && <p className={shared.errorText}>{importError}</p>}
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </ModuleShell>
  );
}
