"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type Equipment } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const STATUS_BADGES: Record<Equipment["status"], string> = {
  available: shared.badgeSuccess,
  in_use: shared.badgeWarn,
  maintenance: shared.badgeDanger,
  retired: shared.badgeDanger,
};

export default function ConstructionEquipmentPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [equipment, setEquipment] = useState<Equipment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", equipment_type: "", notes: "" });

  async function load() {
    try {
      setEquipment(await api.listEquipment());
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load equipment.");
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
      await api.createEquipment(form);
      setForm({ name: "", equipment_type: "", notes: "" });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save equipment.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteEquipment(id);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete equipment.");
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("construction.manage") ?? false;

  return (
    <ModuleShell moduleKey="construction" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Equipment</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
            <p className={shared.hint} style={{ marginTop: 4 }}>
              Assign equipment to a project from that project&apos;s own page.
            </p>
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
                  <th>Type</th>
                  <th>Status</th>
                  <th>Notes</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {equipment?.map((eq) => (
                  <tr key={eq.id}>
                    <td>{eq.name}</td>
                    <td className={shared.tableMuted}>{eq.equipment_type || "—"}</td>
                    <td>
                      <span className={`${shared.badge} ${STATUS_BADGES[eq.status]}`}>{eq.status.replace("_", " ")}</span>
                    </td>
                    <td className={shared.tableMuted}>{eq.notes || "—"}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDelete(eq.id)} disabled={working} />
                      </td>
                    )}
                  </tr>
                ))}
                {equipment?.length === 0 && (
                  <tr>
                    <td colSpan={5} className={shared.tableMuted}>
                      No equipment yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAdd} className={shared.formRow} style={{ marginTop: 12 }}>
                <input
                  placeholder="Name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Type (e.g. excavator)"
                  value={form.equipment_type}
                  onChange={(e) => setForm({ ...form, equipment_type: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className={shared.input}
                />
                <button type="submit" disabled={working || !form.name} className={`${shared.btn} ${shared.btnPrimary}`}>
                  Add equipment
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
