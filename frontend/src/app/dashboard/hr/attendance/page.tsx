"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type AttendanceRecord, type EmployeePickerEntry } from "@/lib/api";
import { useSession } from "@/lib/useSession";

const STATUS_LABELS: Record<AttendanceRecord["status"], string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  half_day: "Half day",
};

const STATUS_COLORS: Record<AttendanceRecord["status"], string> = {
  present: "#2e7d32",
  absent: "#c62828",
  late: "#e65100",
  half_day: "#1565c0",
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
    <main style={{ maxWidth: 900, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <AppHeader activeMembership={activeMembership} />

      {!activeMembership ? (
        <p style={{ color: "#666" }}>
          Pick an active company on the <a href="/dashboard">dashboard</a> first.
        </p>
      ) : (
        <>
          <h1 style={{ fontSize: 20 }}>Attendance — {activeMembership.company.name}</h1>
          <p style={{ color: "#666", fontSize: 13 }}>
            <a href="/dashboard/hr">&larr; Back to HR</a>
          </p>
          {loadError && <p style={{ color: "crimson" }}>{loadError}</p>}

          <section style={{ marginTop: 24, marginBottom: 40 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Employee</th>
                  <th style={{ padding: "6px 4px" }}>Date</th>
                  <th style={{ padding: "6px 4px" }}>Clock in/out</th>
                  <th style={{ padding: "6px 4px" }}>Worked</th>
                  <th style={{ padding: "6px 4px" }}>Overtime</th>
                  <th style={{ padding: "6px 4px" }}>Status</th>
                  <th style={{ padding: "6px 4px" }}>Source</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {records?.map((r) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{employeeName(r.employee)}</td>
                    <td style={{ padding: "6px 4px" }}>{r.date}</td>
                    <td style={{ padding: "6px 4px" }}>
                      {r.clock_in ?? "—"} – {r.clock_out ?? "—"}
                    </td>
                    <td style={{ padding: "6px 4px" }}>{r.worked_hours}h</td>
                    <td style={{ padding: "6px 4px" }}>{r.overtime_hours}h</td>
                    <td style={{ padding: "6px 4px" }}>
                      <span style={{ color: STATUS_COLORS[r.status], fontWeight: 600 }}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td style={{ padding: "6px 4px", color: "#999" }}>
                      {r.source === "device_import" ? "Device" : "Manual"}
                    </td>
                    {canManage && (
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
                        <RowActions onDelete={() => handleDelete(r.id)} disabled={working} />
                      </td>
                    )}
                  </tr>
                ))}
                {records?.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: "6px 4px", color: "#999" }}>
                      No attendance records yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form
                onSubmit={handleAdd}
                style={{
                  marginTop: 16,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 8,
                  maxWidth: 800,
                }}
              >
                <select
                  required
                  value={form.employee}
                  onChange={(e) => setForm({ ...form, employee: e.target.value })}
                  style={{ padding: 8 }}
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
                  style={{ padding: 8 }}
                />
                <input
                  type="time"
                  placeholder="Clock in"
                  value={form.clock_in}
                  onChange={(e) => setForm({ ...form, clock_in: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  type="time"
                  placeholder="Clock out"
                  value={form.clock_out}
                  onChange={(e) => setForm({ ...form, clock_out: e.target.value })}
                  style={{ padding: 8 }}
                />
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as AttendanceRecord["status"] })
                  }
                  style={{ padding: 8 }}
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
                  style={{ padding: 8, gridColumn: "1 / -1" }}
                />
                <button
                  type="submit"
                  disabled={working || !form.employee || !form.date}
                  style={{ padding: "8px 16px" }}
                >
                  Record attendance
                </button>
                {error && <p style={{ color: "crimson", gridColumn: "1 / -1", margin: 0 }}>{error}</p>}
              </form>
            )}

            {canManage && (
              <div style={{ marginTop: 24 }}>
                <button
                  type="button"
                  onClick={() => setImportOpen(!importOpen)}
                  style={{ padding: "6px 12px", fontSize: 13 }}
                >
                  {importOpen ? "Hide" : "Bulk import from device"}
                </button>
                {importOpen && (
                  <form onSubmit={handleImport} style={{ marginTop: 8, maxWidth: 700 }}>
                    <p style={{ fontSize: 12, color: "#999" }}>
                      Paste a JSON array of records exported from a biometric attendance device,
                      e.g. <code>{`[{"employee": 1, "date": "2026-08-01", "clock_in": "08:00", "clock_out": "17:00"}]`}</code>
                    </p>
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      rows={6}
                      style={{ width: "100%", padding: 8, fontFamily: "monospace", fontSize: 12 }}
                    />
                    <button
                      type="submit"
                      disabled={importWorking || !importText}
                      style={{ padding: "8px 16px", marginTop: 8 }}
                    >
                      Import
                    </button>
                    {importError && <p style={{ color: "crimson" }}>{importError}</p>}
                  </form>
                )}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
