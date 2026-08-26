"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { ModuleShell } from "@/components/ModuleShell";
import { IconPlus } from "@/components/icons";
import { api, ApiError, type FolioCharge, type GuestFolio, type Reservation } from "@/lib/api";
import { useSession } from "@/lib/useSession";

const EMPTY_FORM = { folio: "", source_module: "misc" as FolioCharge["source_module"], description: "", amount_cents: "" };

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function ExtraChargesPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [folios, setFolios] = useState<GuestFolio[] | null>(null);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [working, setWorking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function loadAll() {
    try {
      const [f, r] = await Promise.all([api.listFolios(), api.listReservations()]);
      setFolios(f);
      setReservations(r);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load extra charges.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  const rows = useMemo(() => {
    const out: { id: number; guestName: string; confirmation: string; source: string; description: string; amount: number; createdAt: string }[] = [];
    for (const folio of folios ?? []) {
      const reservation = reservations?.find((r) => r.id === folio.reservation);
      for (const c of folio.charges) {
        if (c.source_module === "room") continue;
        out.push({
          id: c.id,
          guestName: reservation?.guest_name ?? "—",
          confirmation: reservation?.confirmation_number ?? `#${folio.reservation}`,
          source: c.source_module,
          description: c.description,
          amount: c.amount_cents,
          createdAt: c.created_at,
        });
      }
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [folios, reservations]);

  const openFolios = (folios ?? []).filter((f) => f.status === "open");

  function startAdd() {
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setFormError(null);
    try {
      await api.createFolioCharge({
        folio: Number(form.folio),
        source_module: form.source_module,
        description: form.description,
        amount_cents: Math.round(Number(form.amount_cents || 0) * 100),
      });
      closeModal();
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to add charge.");
    } finally {
      setWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hotel.manage") ?? false;
  const reservationFor = (id: number) => reservations?.find((r) => r.id === id) ?? null;

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1000, margin: "40px auto", padding: "0 16px 40px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 className="page-title">Extra Charges</h1>
            <p className="page-subtitle">Restaurant, bar, spa, laundry, conference, and other non-room charges posted to guest folios.</p>
          </div>
          {canManage && (
            <button type="button" className="btn btn-primary" style={{ flexShrink: 0 }} onClick={startAdd}>
              <IconPlus size={16} />
              Add Charge
            </button>
          )}
        </div>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        <div className="panel" style={{ marginTop: 20 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Confirmation</th>
                  <th>Guest</th>
                  <th>Source</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.confirmation}</td>
                    <td style={{ fontWeight: 600 }}>{r.guestName}</td>
                    <td>
                      <span className="badge badge-gray">{r.source}</span>
                    </td>
                    <td>{r.description}</td>
                    <td>{formatCents(r.amount)}</td>
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={6}>No extra charges recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {canManage && showModal && (
          <Modal title="Add extra charge" onClose={closeModal}>
            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <select
                className="field-select"
                required
                value={form.folio}
                onChange={(e) => setForm({ ...form, folio: e.target.value })}
              >
                <option value="">Reservation (open folio)…</option>
                {openFolios.map((f) => {
                  const reservation = reservationFor(f.reservation);
                  return (
                    <option key={f.id} value={f.id}>
                      {reservation?.confirmation_number ?? `#${f.reservation}`} — {reservation?.guest_name ?? "—"}
                    </option>
                  );
                })}
              </select>
              <select
                className="field-select"
                value={form.source_module}
                onChange={(e) => setForm({ ...form, source_module: e.target.value as FolioCharge["source_module"] })}
              >
                <option value="restaurant">Restaurant</option>
                <option value="bar">Bar</option>
                <option value="spa">Spa</option>
                <option value="laundry">Laundry</option>
                <option value="conference">Conference</option>
                <option value="misc">Miscellaneous</option>
              </select>
              <input
                className="field-input"
                placeholder="Description"
                required
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
              <input
                className="field-input"
                type="number"
                step="0.01"
                placeholder="Amount"
                required
                value={form.amount_cents}
                onChange={(e) => setForm({ ...form, amount_cents: e.target.value })}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button type="submit" className="btn btn-primary" disabled={working || !form.folio}>
                  Add charge
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Cancel
                </button>
              </div>
              {formError && <p className="error-text" style={{ margin: 0 }}>{formError}</p>}
            </form>
          </Modal>
        )}
      </main>
    </ModuleShell>
  );
}
