"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type Patient } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const BLOOD_TYPES = ["a+", "a-", "b+", "b-", "ab+", "ab-", "o+", "o-"];

export default function PatientsPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "",
    blood_type: "",
    phone: "",
    email: "",
    address: "",
    allergies: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });

  async function load() {
    try {
      setPatients(await api.listPatients());
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load patients.");
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
      await api.createPatient({
        ...form,
        date_of_birth: form.date_of_birth || null,
        gender: (form.gender || "") as Patient["gender"],
      });
      setForm({
        first_name: "",
        last_name: "",
        date_of_birth: "",
        gender: "",
        blood_type: "",
        phone: "",
        email: "",
        address: "",
        allergies: "",
        emergency_contact_name: "",
        emergency_contact_phone: "",
      });
      setShowForm(false);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save patient.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deletePatient(id);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete patient.");
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
            <h1 className={shared.pageTitle}>Patients</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
          {canManage && (
            <div className={shared.pageActions}>
              <button type="button" onClick={() => setShowForm((v) => !v)} className={`${shared.btn} ${shared.btnPrimary}`}>
                {showForm ? "Cancel" : "New patient"}
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
                    <label className={shared.label}>First name</label>
                    <input
                      required
                      value={form.first_name}
                      onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                      className={shared.input}
                    />
                  </div>
                  <div className={shared.field}>
                    <label className={shared.label}>Last name</label>
                    <input
                      required
                      value={form.last_name}
                      onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                      className={shared.input}
                    />
                  </div>
                  <div className={shared.field}>
                    <label className={shared.label}>Date of birth</label>
                    <input
                      type="date"
                      value={form.date_of_birth}
                      onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                      className={shared.input}
                    />
                  </div>
                  <div className={shared.field}>
                    <label className={shared.label}>Gender</label>
                    <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className={shared.select}>
                      <option value="">—</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className={shared.field}>
                    <label className={shared.label}>Blood type</label>
                    <select
                      value={form.blood_type}
                      onChange={(e) => setForm({ ...form, blood_type: e.target.value })}
                      className={shared.select}
                    >
                      <option value="">—</option>
                      {BLOOD_TYPES.map((bt) => (
                        <option key={bt} value={bt}>
                          {bt.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={shared.field}>
                    <label className={shared.label}>Phone</label>
                    <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={shared.input} />
                  </div>
                  <div className={shared.field}>
                    <label className={shared.label}>Email</label>
                    <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={shared.input} />
                  </div>
                  <div className={shared.field}>
                    <label className={shared.label}>Address</label>
                    <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={shared.input} />
                  </div>
                  <div className={shared.field}>
                    <label className={shared.label}>Allergies</label>
                    <input
                      value={form.allergies}
                      onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                      className={shared.input}
                    />
                  </div>
                  <div className={shared.field}>
                    <label className={shared.label}>Emergency contact name</label>
                    <input
                      value={form.emergency_contact_name}
                      onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })}
                      className={shared.input}
                    />
                  </div>
                  <div className={shared.field}>
                    <label className={shared.label}>Emergency contact phone</label>
                    <input
                      value={form.emergency_contact_phone}
                      onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })}
                      className={shared.input}
                    />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <button type="submit" disabled={working} className={`${shared.btn} ${shared.btnPrimary}`}>
                    Save patient
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
                  <th>Name</th>
                  <th>DOB</th>
                  <th>Gender</th>
                  <th>Blood type</th>
                  <th>Phone</th>
                  <th>Allergies</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {patients?.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/dashboard/healthcare/patients/${p.id}`}>{p.name}</Link>
                    </td>
                    <td className={shared.tableMuted}>{p.date_of_birth || "—"}</td>
                    <td className={shared.tableMuted}>{p.gender || "—"}</td>
                    <td className={shared.tableMuted}>{p.blood_type ? p.blood_type.toUpperCase() : "—"}</td>
                    <td className={shared.tableMuted}>{p.phone || "—"}</td>
                    <td className={shared.tableMuted}>{p.allergies || "—"}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDelete(p.id)} disabled={working} />
                      </td>
                    )}
                  </tr>
                ))}
                {patients?.length === 0 && (
                  <tr>
                    <td colSpan={7} className={shared.tableMuted}>
                      No patients yet.
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
