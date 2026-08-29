"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type CashierShift, type Register } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function RegistersPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [registers, setRegisters] = useState<Register[] | null>(null);
  const [shifts, setShifts] = useState<CashierShift[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [registerForm, setRegisterForm] = useState({ name: "", code: "" });
  const [openForm, setOpenForm] = useState({ register: "", opening_float_cents: "" });
  const [closingAmounts, setClosingAmounts] = useState<Record<number, string>>({});

  async function loadAll() {
    try {
      const [r, s] = await Promise.all([api.listRegisters(), api.listCashierShifts()]);
      setRegisters(r);
      setShifts(s);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load registers.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAddRegister(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    try {
      await api.createRegister({ name: registerForm.name, code: registerForm.code });
      setRegisterForm({ name: "", code: "" });
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to save register.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDeleteRegister(id: number) {
    try {
      await api.deleteRegister(id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete register.");
    }
  }

  async function handleOpenShift(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setActionError(null);
    try {
      await api.openCashierShift({
        register: Number(openForm.register),
        opening_float_cents: openForm.opening_float_cents ? Math.round(Number(openForm.opening_float_cents) * 100) : 0,
      });
      setOpenForm({ register: "", opening_float_cents: "" });
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to open shift.");
    } finally {
      setWorking(false);
    }
  }

  async function handleCloseShift(id: number) {
    const amount = closingAmounts[id];
    if (!amount) return;
    setWorking(true);
    setActionError(null);
    try {
      await api.closeCashierShift(id, Math.round(Number(amount) * 100));
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to close shift.");
    } finally {
      setWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("retail.manage") ?? false;
  const openRegisterIds = new Set((shifts ?? []).filter((s) => s.status === "open").map((s) => s.register));

  return (
    <ModuleShell moduleKey="retail" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Registers & Shifts</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}
        {actionError && <p className={shared.errorText}>{actionError}</p>}

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Registers</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {registers?.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td className={shared.tableMuted}>{r.code || "—"}</td>
                    <td>
                      <span className={`${shared.badge} ${openRegisterIds.has(r.id) ? shared.badgeSuccess : ""}`}>
                        {openRegisterIds.has(r.id) ? "Shift open" : "No open shift"}
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDeleteRegister(r.id)} disabled={working} />
                      </td>
                    )}
                  </tr>
                ))}
                {registers?.length === 0 && (
                  <tr>
                    <td colSpan={4} className={shared.tableMuted}>
                      No registers yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddRegister} className={shared.formRow} style={{ marginTop: 12 }}>
                <input
                  placeholder="Register name"
                  required
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Code"
                  value={registerForm.code}
                  onChange={(e) => setRegisterForm({ ...registerForm, code: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 120 }}
                />
                <button type="submit" disabled={working || !registerForm.name} className={`${shared.btn} ${shared.btnPrimary}`}>
                  Add register
                </button>
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Shifts</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Register</th>
                  <th>Cashier</th>
                  <th>Opening float</th>
                  <th>Closing amount</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {shifts?.map((s) => (
                  <tr key={s.id}>
                    <td>{s.register_name}</td>
                    <td className={shared.tableMuted}>{s.cashier_name}</td>
                    <td className={shared.tableMuted}>{formatCents(s.opening_float_cents)}</td>
                    <td className={shared.tableMuted}>
                      {s.closing_amount_cents != null ? formatCents(s.closing_amount_cents) : "—"}
                    </td>
                    <td>
                      <span className={`${shared.badge} ${s.status === "open" ? shared.badgeWarn : shared.badgeSuccess}`}>
                        {s.status}
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        {s.status === "open" && (
                          <span style={{ display: "inline-flex", gap: 6 }}>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="Amount"
                              value={closingAmounts[s.id] ?? ""}
                              onChange={(e) => setClosingAmounts({ ...closingAmounts, [s.id]: e.target.value })}
                              className={shared.input}
                              style={{ maxWidth: 100 }}
                            />
                            <button
                              type="button"
                              onClick={() => handleCloseShift(s.id)}
                              disabled={working || !closingAmounts[s.id]}
                              className={`${shared.btn} ${shared.btnSmall}`}
                            >
                              Close
                            </button>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {shifts?.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      No shifts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleOpenShift} className={shared.formRow} style={{ marginTop: 12 }}>
                <select
                  required
                  value={openForm.register}
                  onChange={(e) => setOpenForm({ ...openForm, register: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Register…</option>
                  {registers?.filter((r) => !openRegisterIds.has(r.id)).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Opening float"
                  value={openForm.opening_float_cents}
                  onChange={(e) => setOpenForm({ ...openForm, opening_float_cents: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 140 }}
                />
                <button type="submit" disabled={working || !openForm.register} className={`${shared.btn} ${shared.btnPrimary}`}>
                  Open shift
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
