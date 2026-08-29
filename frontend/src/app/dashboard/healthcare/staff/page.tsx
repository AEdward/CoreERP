"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type MedicalStaff } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

export default function MedicalStaffPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [staff, setStaff] = useState<MedicalStaff[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [form, setForm] = useState({
    role: "doctor" as MedicalStaff["role"],
    name: "",
    specialization: "",
    license_number: "",
    phone: "",
    email: "",
  });

  async function load() {
    try {
      setStaff(await api.listMedicalStaff());
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load staff.");
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
      await api.createMedicalStaff(form);
      setForm({ role: "doctor", name: "", specialization: "", license_number: "", phone: "", email: "" });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save staff member.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteMedicalStaff(id);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete staff member.");
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
            <h1 className={shared.pageTitle}>Staff</h1>
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
                  <th>Name</th>
                  <th>Role</th>
                  <th>Specialization</th>
                  <th>License #</th>
                  <th>Phone</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {staff?.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td className={shared.tableMuted}>{s.role}</td>
                    <td className={shared.tableMuted}>{s.specialization || "—"}</td>
                    <td className={shared.tableMuted}>{s.license_number || "—"}</td>
                    <td className={shared.tableMuted}>{s.phone || "—"}</td>
                    <td>
                      <span className={`${shared.badge} ${s.is_active ? shared.badgeSuccess : shared.badgeDanger}`}>
                        {s.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDelete(s.id)} disabled={working} />
                      </td>
                    )}
                  </tr>
                ))}
                {staff?.length === 0 && (
                  <tr>
                    <td colSpan={7} className={shared.tableMuted}>
                      No medical staff yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAdd} className={shared.formRow} style={{ marginTop: 12, flexWrap: "wrap" }}>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as MedicalStaff["role"] })}
                  className={shared.select}
                >
                  <option value="doctor">Doctor</option>
                  <option value="nurse">Nurse</option>
                </select>
                <input
                  placeholder="Name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Specialization"
                  value={form.specialization}
                  onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="License #"
                  value={form.license_number}
                  onChange={(e) => setForm({ ...form, license_number: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={shared.input}
                />
                <button type="submit" disabled={working || !form.name} className={`${shared.btn} ${shared.btnPrimary}`}>
                  Add staff
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
