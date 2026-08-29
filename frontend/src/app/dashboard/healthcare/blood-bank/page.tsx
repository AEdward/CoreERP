"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type BloodUnit, type Patient } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const BLOOD_TYPES = ["a+", "a-", "b+", "b-", "ab+", "ab-", "o+", "o-"];

const STATUS_BADGES: Record<BloodUnit["status"], string> = {
  available: shared.badgeSuccess,
  reserved: shared.badgeWarn,
  used: shared.badgeInfo,
  expired: shared.badgeDanger,
  discarded: shared.badgeDanger,
};

export default function BloodBankPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [units, setUnits] = useState<BloodUnit[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [form, setForm] = useState({ blood_type: "o+", volume_ml: "450", collected_date: "", expiry_date: "", notes: "" });
  const [reserveFor, setReserveFor] = useState<Record<number, string>>({});

  async function load() {
    try {
      const [u, p] = await Promise.all([api.listBloodUnits(), api.listPatients()]);
      setUnits(u);
      setPatients(p);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load blood units.");
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
      await api.createBloodUnit({
        blood_type: form.blood_type,
        volume_ml: Number(form.volume_ml),
        collected_date: form.collected_date,
        expiry_date: form.expiry_date,
        notes: form.notes,
      });
      setForm({ blood_type: "o+", volume_ml: "450", collected_date: "", expiry_date: "", notes: "" });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save blood unit.");
    } finally {
      setWorking(false);
    }
  }

  async function handleReserve(id: number) {
    const patientId = reserveFor[id];
    if (!patientId) return;
    setWorking(true);
    setActionError(null);
    try {
      await api.reserveBloodUnit(id, Number(patientId));
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to reserve unit.");
    } finally {
      setWorking(false);
    }
  }

  async function handleUse(id: number) {
    setWorking(true);
    setActionError(null);
    try {
      await api.useBloodUnit(id);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to mark unit used.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDiscard(id: number) {
    if (!confirm("Discard this unit? This can't be undone.")) return;
    setWorking(true);
    setActionError(null);
    try {
      await api.discardBloodUnit(id);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to discard unit.");
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
            <h1 className={shared.pageTitle}>Blood Bank</h1>
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
                  <th>Blood type</th>
                  <th>Volume</th>
                  <th>Collected</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th>Reserved for</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id}>
                    <td>{u.blood_type.toUpperCase()}</td>
                    <td className={shared.tableMuted}>{u.volume_ml} ml</td>
                    <td className={shared.tableMuted}>{u.collected_date}</td>
                    <td className={shared.tableMuted}>{u.expiry_date}</td>
                    <td>
                      <span className={`${shared.badge} ${STATUS_BADGES[u.status]}`}>{u.status}</span>
                    </td>
                    <td className={shared.tableMuted}>{u.reserved_for_name || "—"}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        {u.status === "available" && (
                          <span style={{ display: "inline-flex", gap: 6 }}>
                            <select
                              value={reserveFor[u.id] ?? ""}
                              onChange={(e) => setReserveFor({ ...reserveFor, [u.id]: e.target.value })}
                              className={shared.select}
                              style={{ maxWidth: 140 }}
                            >
                              <option value="">Patient…</option>
                              {patients.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleReserve(u.id)}
                              disabled={working || !reserveFor[u.id]}
                              className={`${shared.btn} ${shared.btnSmall}`}
                            >
                              Reserve
                            </button>
                          </span>
                        )}
                        {u.status === "reserved" && (
                          <button
                            type="button"
                            onClick={() => handleUse(u.id)}
                            disabled={working}
                            className={`${shared.btn} ${shared.btnSmall}`}
                          >
                            Mark used
                          </button>
                        )}
                        {(u.status === "available" || u.status === "reserved" || u.status === "expired") && (
                          <button
                            type="button"
                            onClick={() => handleDiscard(u.id)}
                            disabled={working}
                            className={`${shared.btn} ${shared.btnSmall}`}
                            style={{ marginLeft: 6 }}
                          >
                            Discard
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {units.length === 0 && (
                  <tr>
                    <td colSpan={7} className={shared.tableMuted}>
                      No blood units yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAdd} className={shared.formRow} style={{ marginTop: 12, flexWrap: "wrap" }}>
                <select
                  value={form.blood_type}
                  onChange={(e) => setForm({ ...form, blood_type: e.target.value })}
                  className={shared.select}
                >
                  {BLOOD_TYPES.map((bt) => (
                    <option key={bt} value={bt}>
                      {bt.toUpperCase()}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  placeholder="Volume ml"
                  value={form.volume_ml}
                  onChange={(e) => setForm({ ...form, volume_ml: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 100 }}
                />
                <input
                  type="date"
                  required
                  value={form.collected_date}
                  onChange={(e) => setForm({ ...form, collected_date: e.target.value })}
                  className={shared.input}
                />
                <input
                  type="date"
                  required
                  value={form.expiry_date}
                  onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={working || !form.collected_date || !form.expiry_date}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Add unit
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
