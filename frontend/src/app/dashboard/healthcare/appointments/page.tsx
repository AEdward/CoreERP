"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type Appointment, type MedicalStaff, type Patient } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const STATUS_BADGES: Record<Appointment["status"], string> = {
  scheduled: shared.badgeInfo,
  checked_in: shared.badgeWarn,
  completed: shared.badgeSuccess,
  cancelled: shared.badgeDanger,
  no_show: shared.badgeDanger,
};

export default function AppointmentsPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [staff, setStaff] = useState<MedicalStaff[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [form, setForm] = useState({
    patient: "",
    staff: "",
    visit_type: "outpatient" as Appointment["visit_type"],
    scheduled_at: "",
    room: "",
    reason: "",
  });

  async function load() {
    try {
      const [a, p, s] = await Promise.all([api.listAppointments(), api.listPatients(), api.listMedicalStaff()]);
      setAppointments(a);
      setPatients(p);
      setStaff(s);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load appointments.");
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
      await api.createAppointment({
        patient: Number(form.patient),
        staff: Number(form.staff),
        visit_type: form.visit_type,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        room: form.room,
        reason: form.reason,
      });
      setForm({ patient: "", staff: "", visit_type: "outpatient", scheduled_at: "", room: "", reason: "" });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save appointment.");
    } finally {
      setWorking(false);
    }
  }

  async function handleTransition(fn: (id: number) => Promise<Appointment>, id: number) {
    setWorking(true);
    setActionError(null);
    try {
      await fn(id);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update appointment.");
    } finally {
      setWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("healthcare.manage") ?? false;

  return (
    <ModuleShell moduleKey="healthcare" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Appointments</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}
        {actionError && <p className={shared.errorText}>{actionError}</p>}

        <div className={shared.section}>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Staff</th>
                  <th>Visit type</th>
                  <th>Scheduled</th>
                  <th>Reason</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {appointments?.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <Link href={`/dashboard/healthcare/patients/${a.patient}`}>{a.patient_name}</Link>
                    </td>
                    <td className={shared.tableMuted}>{a.staff_name}</td>
                    <td className={shared.tableMuted}>{a.visit_type}</td>
                    <td className={shared.tableMuted}>{new Date(a.scheduled_at).toLocaleString()}</td>
                    <td className={shared.tableMuted}>{a.reason || "—"}</td>
                    <td>
                      <span className={`${shared.badge} ${STATUS_BADGES[a.status]}`}>{a.status}</span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        {a.status === "scheduled" && (
                          <span style={{ display: "inline-flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleTransition(api.checkInAppointment, a.id)}
                              disabled={working}
                              className={`${shared.btn} ${shared.btnSmall}`}
                            >
                              Check in
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTransition(api.noShowAppointment, a.id)}
                              disabled={working}
                              className={`${shared.btn} ${shared.btnSmall}`}
                            >
                              No-show
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTransition(api.cancelAppointment, a.id)}
                              disabled={working}
                              className={`${shared.btn} ${shared.btnSmall}`}
                            >
                              Cancel
                            </button>
                          </span>
                        )}
                        {a.status === "checked_in" && (
                          <button
                            type="button"
                            onClick={() => handleTransition(api.completeAppointment, a.id)}
                            disabled={working}
                            className={`${shared.btn} ${shared.btnSmall}`}
                          >
                            Complete
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {appointments?.length === 0 && (
                  <tr>
                    <td colSpan={7} className={shared.tableMuted}>
                      No appointments yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAdd} className={shared.formRow} style={{ marginTop: 12, flexWrap: "wrap" }}>
                <select
                  required
                  value={form.patient}
                  onChange={(e) => setForm({ ...form, patient: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Patient…</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={form.staff}
                  onChange={(e) => setForm({ ...form, staff: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Staff…</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={form.visit_type}
                  onChange={(e) => setForm({ ...form, visit_type: e.target.value as Appointment["visit_type"] })}
                  className={shared.select}
                >
                  <option value="outpatient">Outpatient</option>
                  <option value="inpatient">Inpatient</option>
                  <option value="emergency">Emergency</option>
                  <option value="surgery">Surgery</option>
                </select>
                <input
                  type="datetime-local"
                  required
                  value={form.scheduled_at}
                  onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Room"
                  value={form.room}
                  onChange={(e) => setForm({ ...form, room: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 100 }}
                />
                <input
                  placeholder="Reason"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={working || !form.patient || !form.staff || !form.scheduled_at}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Schedule
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
