"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type Admission, type Bed, type MedicalStaff, type Patient } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

export default function AdmissionsPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [beds, setBeds] = useState<Bed[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [staff, setStaff] = useState<MedicalStaff[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [bedForm, setBedForm] = useState({ ward: "", bed_number: "" });
  const [admissionForm, setAdmissionForm] = useState({ patient: "", bed: "", admitting_doctor: "", reason: "" });

  async function load() {
    try {
      const [b, a, p, s] = await Promise.all([
        api.listBeds(),
        api.listAdmissions(),
        api.listPatients(),
        api.listMedicalStaff(),
      ]);
      setBeds(b);
      setAdmissions(a);
      setPatients(p);
      setStaff(s);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load admissions.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAddBed(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setActionError(null);
    try {
      await api.createBed(bedForm);
      setBedForm({ ward: "", bed_number: "" });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save bed.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDeleteBed(id: number) {
    try {
      await api.deleteBed(id);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete bed.");
    }
  }

  async function handleAdmit(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setActionError(null);
    try {
      await api.createAdmission({
        patient: Number(admissionForm.patient),
        bed: Number(admissionForm.bed),
        admitting_doctor: Number(admissionForm.admitting_doctor),
        reason: admissionForm.reason,
      });
      setAdmissionForm({ patient: "", bed: "", admitting_doctor: "", reason: "" });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to admit patient.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDischarge(id: number) {
    setWorking(true);
    setActionError(null);
    try {
      await api.dischargeAdmission(id);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to discharge patient.");
    } finally {
      setWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("healthcare.manage") ?? false;
  const availableBeds = beds.filter((b) => b.status === "available");

  return (
    <ModuleShell moduleKey="healthcare" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Admissions & Beds</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}
        {actionError && <p className={shared.errorText}>{actionError}</p>}

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Beds</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Ward</th>
                  <th>Bed #</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {beds.map((b) => (
                  <tr key={b.id}>
                    <td>{b.ward}</td>
                    <td className={shared.tableMuted}>{b.bed_number}</td>
                    <td>
                      <span
                        className={`${shared.badge} ${
                          b.status === "available"
                            ? shared.badgeSuccess
                            : b.status === "occupied"
                              ? shared.badgeWarn
                              : shared.badgeDanger
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDeleteBed(b.id)} disabled={working} />
                      </td>
                    )}
                  </tr>
                ))}
                {beds.length === 0 && (
                  <tr>
                    <td colSpan={4} className={shared.tableMuted}>
                      No beds yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddBed} className={shared.formRow} style={{ marginTop: 12 }}>
                <input
                  placeholder="Ward"
                  required
                  value={bedForm.ward}
                  onChange={(e) => setBedForm({ ...bedForm, ward: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Bed #"
                  required
                  value={bedForm.bed_number}
                  onChange={(e) => setBedForm({ ...bedForm, bed_number: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 100 }}
                />
                <button type="submit" disabled={working} className={`${shared.btn} ${shared.btnPrimary}`}>
                  Add bed
                </button>
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Admissions</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Patient</th>
                  <th>Bed</th>
                  <th>Doctor</th>
                  <th>Reason</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {admissions.map((a) => (
                  <tr key={a.id}>
                    <td>{a.number}</td>
                    <td>
                      <Link href={`/dashboard/healthcare/patients/${a.patient}`}>{a.patient_name}</Link>
                    </td>
                    <td className={shared.tableMuted}>{a.bed_label}</td>
                    <td className={shared.tableMuted}>{a.doctor_name}</td>
                    <td className={shared.tableMuted}>{a.reason || "—"}</td>
                    <td>
                      <span className={`${shared.badge} ${a.status === "admitted" ? shared.badgeWarn : shared.badgeSuccess}`}>
                        {a.status}
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        {a.status === "admitted" && (
                          <button
                            type="button"
                            onClick={() => handleDischarge(a.id)}
                            disabled={working}
                            className={`${shared.btn} ${shared.btnSmall}`}
                          >
                            Discharge
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {admissions.length === 0 && (
                  <tr>
                    <td colSpan={7} className={shared.tableMuted}>
                      No admissions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAdmit} className={shared.formRow} style={{ marginTop: 12, flexWrap: "wrap" }}>
                <select
                  required
                  value={admissionForm.patient}
                  onChange={(e) => setAdmissionForm({ ...admissionForm, patient: e.target.value })}
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
                  value={admissionForm.bed}
                  onChange={(e) => setAdmissionForm({ ...admissionForm, bed: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Bed…</option>
                  {availableBeds.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.ward} — {b.bed_number}
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={admissionForm.admitting_doctor}
                  onChange={(e) => setAdmissionForm({ ...admissionForm, admitting_doctor: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Admitting doctor…</option>
                  {staff.filter((s) => s.role === "doctor").map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Reason"
                  value={admissionForm.reason}
                  onChange={(e) => setAdmissionForm({ ...admissionForm, reason: e.target.value })}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={working || !admissionForm.patient || !admissionForm.bed || !admissionForm.admitting_doctor}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Admit patient
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
