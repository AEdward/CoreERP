"use client";

import { Fragment, useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type FolioCharge, type GuestFolio, type Reservation } from "@/lib/api";
import { useSession } from "@/lib/useSession";

const EMPTY_CHARGE_FORM = { source_module: "misc" as FolioCharge["source_module"], description: "", amount_cents: "" };

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function GuestFoliosPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [folios, setFolios] = useState<GuestFolio[] | null>(null);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [chargeForm, setChargeForm] = useState(EMPTY_CHARGE_FORM);
  const [chargeWorking, setChargeWorking] = useState(false);
  const [chargeError, setChargeError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  async function loadAll() {
    try {
      const [f, r] = await Promise.all([api.listFolios(), api.listReservations()]);
      setFolios(f);
      setReservations(r);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load guest folios.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAddCharge(e: React.FormEvent, folioId: number) {
    e.preventDefault();
    setChargeWorking(true);
    setChargeError(null);
    try {
      await api.createFolioCharge({
        folio: folioId,
        source_module: chargeForm.source_module,
        description: chargeForm.description,
        amount_cents: Math.round(Number(chargeForm.amount_cents || 0) * 100),
      });
      setChargeForm(EMPTY_CHARGE_FORM);
      await loadAll();
    } catch (err) {
      setChargeError(err instanceof ApiError ? err.message : "Failed to add charge.");
    } finally {
      setChargeWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hotel.manage") ?? false;
  const reservationFor = (id: number) => reservations?.find((r) => r.id === id) ?? null;
  const filtered = folios?.filter((f) => !statusFilter || f.status === statusFilter) ?? [];

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px 40px" }}>
        <h1 className="page-title">Guest Folios</h1>
        <p className="page-subtitle">Every reservation&apos;s running bill — created automatically, closed at check-out.</p>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        <div className="panel" style={{ marginTop: 20 }}>
          <select
            className="field-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ maxWidth: 180, marginBottom: 16 }}
          >
            <option value="">All folios</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reservation</th>
                  <th>Guest</th>
                  <th>Status</th>
                  <th>Balance</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((folio) => {
                  const reservation = reservationFor(folio.reservation);
                  const isExpanded = expandedId === folio.id;
                  return (
                    <Fragment key={folio.id}>
                      <tr>
                        <td>{reservation?.confirmation_number ?? `Reservation #${folio.reservation}`}</td>
                        <td style={{ fontWeight: 600 }}>{reservation?.guest_name ?? "—"}</td>
                        <td>
                          <span className={`badge ${folio.status === "open" ? "badge-gold" : "badge-gray"}`}>
                            {folio.status}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${folio.balance_cents > 0 ? "badge-red" : "badge-green"}`}>
                            {formatCents(folio.balance_cents)}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setExpandedId(isExpanded ? null : folio.id)}
                          >
                            {isExpanded ? "Hide" : "View charges"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} style={{ padding: 12, background: "var(--brand-ivory)" }}>
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Source</th>
                                  <th>Description</th>
                                  <th>Amount</th>
                                  <th>Tax incl.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {folio.charges.map((c) => (
                                  <tr key={c.id}>
                                    <td>{c.source_module}</td>
                                    <td>{c.description}</td>
                                    <td>{formatCents(c.amount_cents)}</td>
                                    <td style={{ color: "#8a8577" }}>{formatCents(c.tax_amount_cents)}</td>
                                  </tr>
                                ))}
                                {folio.charges.length === 0 && (
                                  <tr className="empty-row">
                                    <td colSpan={4}>No charges yet.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                            {canManage && folio.status === "open" && (
                              <form
                                onSubmit={(e) => handleAddCharge(e, folio.id)}
                                style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}
                              >
                                <select
                                  className="field-select"
                                  value={chargeForm.source_module}
                                  onChange={(e) =>
                                    setChargeForm({
                                      ...chargeForm,
                                      source_module: e.target.value as FolioCharge["source_module"],
                                    })
                                  }
                                >
                                  <option value="room">Room</option>
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
                                  value={chargeForm.description}
                                  onChange={(e) => setChargeForm({ ...chargeForm, description: e.target.value })}
                                  style={{ flex: 1, minWidth: 160 }}
                                />
                                <input
                                  className="field-input"
                                  type="number"
                                  step="0.01"
                                  placeholder="Amount"
                                  required
                                  value={chargeForm.amount_cents}
                                  onChange={(e) => setChargeForm({ ...chargeForm, amount_cents: e.target.value })}
                                  style={{ width: 110 }}
                                />
                                <button type="submit" className="btn btn-primary btn-sm" disabled={chargeWorking}>
                                  Add charge
                                </button>
                              </form>
                            )}
                            {chargeError && <p className="error-text" style={{ fontSize: 12, marginTop: 6 }}>{chargeError}</p>}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {filtered.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={5}>No folios match this filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </ModuleShell>
  );
}
