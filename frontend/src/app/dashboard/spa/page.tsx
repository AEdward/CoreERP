"use client";

import { Fragment, useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { ModuleShell } from "@/components/ModuleShell";
import { IconPlus } from "@/components/icons";
import {
  api,
  ApiError,
  type Item,
  type Reservation,
  type SpaBooking,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";

const EMPTY_LINE = { treatment: "", duration_minutes: "60", scheduled_at: "", quantity: "1", unit_price_cents: "" };
const EMPTY_ADD_LINE = { ...EMPTY_LINE };

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const TREATMENT_BADGE: Record<SpaBooking["lines"][number]["status"], string> = {
  scheduled: "badge-gray",
  in_progress: "badge-gold",
  completed: "badge-green",
  cancelled: "badge-red",
};

const STATUS_BADGE: Record<SpaBooking["status"], string> = {
  open: "badge-gold",
  paid: "badge-green",
  charged_to_room: "badge-green",
  cancelled: "badge-red",
};

export default function SpaPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [bookings, setBookings] = useState<SpaBooking[] | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [bookingReservation, setBookingReservation] = useState("");
  const [bookingLines, setBookingLines] = useState([{ ...EMPTY_LINE }]);
  const [bookingWorking, setBookingWorking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [addLineForm, setAddLineForm] = useState(EMPTY_ADD_LINE);
  const [addLineWorking, setAddLineWorking] = useState(false);

  async function loadAll() {
    try {
      const [b, i, r] = await Promise.all([
        api.listSpaBookings(),
        api.listItems(),
        api.listReservations(),
      ]);
      setBookings(b);
      setItems(i);
      setReservations(r);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load spa data.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  function updateBookingLine(index: number, patch: Partial<(typeof EMPTY_LINE)>) {
    const next = bookingLines.slice();
    next[index] = { ...next[index], ...patch };
    setBookingLines(next);
  }

  async function handleCreateBooking(e: React.FormEvent) {
    e.preventDefault();
    setBookingWorking(true);
    setBookingError(null);
    try {
      await api.createSpaBooking({
        reservation: bookingReservation ? Number(bookingReservation) : null,
        lines: bookingLines
          .filter((l) => l.treatment && l.quantity)
          .map((l) => ({
            treatment: Number(l.treatment),
            duration_minutes: Number(l.duration_minutes || 60),
            scheduled_at: l.scheduled_at ? new Date(l.scheduled_at).toISOString() : null,
            quantity: Number(l.quantity),
            unit_price_cents: Math.round(Number(l.unit_price_cents || 0) * 100),
          })),
      });
      setBookingReservation("");
      setBookingLines([{ ...EMPTY_LINE }]);
      setShowBookingModal(false);
      await loadAll();
    } catch (err) {
      setBookingError(err instanceof ApiError ? err.message : "Failed to create booking.");
    } finally {
      setBookingWorking(false);
    }
  }

  function startAddBooking() {
    setBookingReservation("");
    setBookingLines([{ ...EMPTY_LINE }]);
    setBookingError(null);
    setShowBookingModal(true);
  }

  function closeBookingModal() {
    setShowBookingModal(false);
    setBookingReservation("");
    setBookingLines([{ ...EMPTY_LINE }]);
    setBookingError(null);
  }

  async function handleTreatment(lineId: number, action: "startSpaTreatment" | "completeSpaTreatment" | "cancelSpaTreatment") {
    setActionError(null);
    try {
      await api[action](lineId);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update treatment.");
    }
  }

  async function handleChargeToRoom(id: number) {
    setActionError(null);
    try {
      await api.chargeSpaBookingToRoom(id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to charge to room.");
    }
  }

  async function handleMarkPaid(id: number) {
    setActionError(null);
    try {
      await api.markSpaBookingPaid(id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to mark paid.");
    }
  }

  async function handleCancelBooking(id: number) {
    setActionError(null);
    try {
      await api.cancelSpaBooking(id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to cancel booking.");
    }
  }

  async function handleAddLine(e: React.FormEvent, bookingId: number) {
    e.preventDefault();
    setAddLineWorking(true);
    setActionError(null);
    try {
      await api.addSpaBookingLine({
        booking: bookingId,
        treatment: Number(addLineForm.treatment),
        duration_minutes: Number(addLineForm.duration_minutes || 60),
        scheduled_at: addLineForm.scheduled_at ? new Date(addLineForm.scheduled_at).toISOString() : null,
        quantity: Number(addLineForm.quantity || 1),
        unit_price_cents: Math.round(Number(addLineForm.unit_price_cents || 0) * 100),
      });
      setAddLineForm({ ...EMPTY_ADD_LINE });
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to add treatment.");
    } finally {
      setAddLineWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("spa.manage") ?? false;
  const openReservations = reservations?.filter((r) => r.status === "checked_in") ?? [];

  return (
    <ModuleShell moduleKey="spa" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1150, margin: "40px auto", padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <h1 className="page-title">Spa & Wellness — {activeMembership?.company.name}</h1>
          {canManage && (
            <button type="button" className="btn btn-primary" onClick={startAddBooking} style={{ flexShrink: 0 }}>
              <IconPlus size={16} />
              New booking
            </button>
          )}
        </div>
        {loadError && <p className="error-text">{loadError}</p>}
        {actionError && <p className="error-text">{actionError}</p>}

        {/* Bookings */}
        <section style={{ marginTop: 20, marginBottom: 40 }}>
          <h2 className="section-label">Bookings</h2>
          <div className="panel" style={{ marginTop: 8 }}>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Room charge</th>
                    <th>Treatments</th>
                    <th>Total</th>
                    <th>Billing</th>
                    <th>Receipt</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {bookings?.map((b) => {
                    const isExpanded = expandedId === b.id;
                    return (
                      <Fragment key={b.id}>
                        <tr>
                          <td>{b.reservation ? `Res #${b.reservation}` : "—"}</td>
                          <td>{b.lines.length}</td>
                          <td>{formatCents(b.total_cents)}</td>
                          <td>
                            <span className={`badge ${STATUS_BADGE[b.status]}`}>{b.status.replace(/_/g, " ")}</span>
                          </td>
                          <td>{b.receipt_number || "—"}</td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            {canManage && b.status === "open" && (
                              <>
                                {b.reservation && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleChargeToRoom(b.id)}
                                    style={{ marginRight: 4 }}
                                  >
                                    Charge to room
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleMarkPaid(b.id)}
                                  style={{ marginRight: 4 }}
                                >
                                  Mark paid
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleCancelBooking(b.id)}
                                  style={{ marginRight: 4 }}
                                >
                                  Cancel
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setExpandedId(isExpanded ? null : b.id)}
                            >
                              {isExpanded ? "Hide treatments" : "View treatments"}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} style={{ padding: 12, background: "var(--brand-ivory)" }}>
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>Treatment</th>
                                    <th>Scheduled</th>
                                    <th>Mins</th>
                                    <th>Price</th>
                                    <th>Status</th>
                                    <th></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {b.lines.map((l) => (
                                    <tr key={l.id}>
                                      <td>{l.treatment_name}</td>
                                      <td>{l.scheduled_at ? new Date(l.scheduled_at).toLocaleString() : "—"}</td>
                                      <td>{l.duration_minutes}</td>
                                      <td>{formatCents(l.line_total_cents)}</td>
                                      <td>
                                        <span className={`badge ${TREATMENT_BADGE[l.status]}`}>{l.status.replace(/_/g, " ")}</span>
                                      </td>
                                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                        {canManage && l.status === "scheduled" && (
                                          <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => handleTreatment(l.id, "startSpaTreatment")}
                                            style={{ marginRight: 4 }}
                                          >
                                            Start
                                          </button>
                                        )}
                                        {canManage && l.status === "in_progress" && (
                                          <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => handleTreatment(l.id, "completeSpaTreatment")}
                                            style={{ marginRight: 4 }}
                                          >
                                            Complete
                                          </button>
                                        )}
                                        {canManage && (l.status === "scheduled" || l.status === "in_progress") && (
                                          <button
                                            type="button"
                                            className="btn btn-danger btn-sm"
                                            onClick={() => handleTreatment(l.id, "cancelSpaTreatment")}
                                          >
                                            Cancel
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {canManage && b.status === "open" && (
                                <form
                                  onSubmit={(e) => handleAddLine(e, b.id)}
                                  style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}
                                >
                                  <select
                                    className="field-select"
                                    value={addLineForm.treatment}
                                    onChange={(e) => setAddLineForm({ ...addLineForm, treatment: e.target.value })}
                                  >
                                    <option value="">Treatment…</option>
                                    {items?.map((it) => (
                                      <option key={it.id} value={it.id}>
                                        {it.name}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    className="field-input"
                                    type="datetime-local"
                                    value={addLineForm.scheduled_at}
                                    onChange={(e) => setAddLineForm({ ...addLineForm, scheduled_at: e.target.value })}
                                  />
                                  <input
                                    className="field-input"
                                    type="number"
                                    placeholder="Mins"
                                    value={addLineForm.duration_minutes}
                                    onChange={(e) => setAddLineForm({ ...addLineForm, duration_minutes: e.target.value })}
                                    style={{ width: 70 }}
                                  />
                                  <input
                                    className="field-input"
                                    type="number"
                                    min={1}
                                    placeholder="Qty"
                                    value={addLineForm.quantity}
                                    onChange={(e) => setAddLineForm({ ...addLineForm, quantity: e.target.value })}
                                    style={{ width: 60 }}
                                  />
                                  <input
                                    className="field-input"
                                    type="number"
                                    step="0.01"
                                    placeholder="Price"
                                    value={addLineForm.unit_price_cents}
                                    onChange={(e) => setAddLineForm({ ...addLineForm, unit_price_cents: e.target.value })}
                                    style={{ width: 90 }}
                                  />
                                  <button
                                    type="submit"
                                    className="btn btn-primary btn-sm"
                                    disabled={addLineWorking || !addLineForm.treatment}
                                  >
                                    Add treatment
                                  </button>
                                </form>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {bookings?.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={6}>No spa bookings yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {canManage && showBookingModal && (
          <Modal title="New booking" onClose={closeBookingModal}>
            <form onSubmit={handleCreateBooking}>
              <select
                className="field-select"
                value={bookingReservation}
                onChange={(e) => setBookingReservation(e.target.value)}
                style={{ marginBottom: 8, width: "100%", maxWidth: 360 }}
              >
                <option value="">No room charge</option>
                {openReservations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.confirmation_number} — {r.guest_name} (Room {r.room_number})
                  </option>
                ))}
              </select>

              {bookingLines.map((line, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <select
                    className="field-select"
                    value={line.treatment}
                    onChange={(e) => updateBookingLine(i, { treatment: e.target.value })}
                    style={{ flex: 2, minWidth: 160 }}
                  >
                    <option value="">Treatment…</option>
                    {items?.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="field-input"
                    type="datetime-local"
                    value={line.scheduled_at}
                    onChange={(e) => updateBookingLine(i, { scheduled_at: e.target.value })}
                  />
                  <input
                    className="field-input"
                    type="number"
                    placeholder="Mins"
                    value={line.duration_minutes}
                    onChange={(e) => updateBookingLine(i, { duration_minutes: e.target.value })}
                    style={{ width: 70 }}
                  />
                  <input
                    className="field-input"
                    type="number"
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={(e) => updateBookingLine(i, { quantity: e.target.value })}
                    style={{ width: 60 }}
                  />
                  <input
                    className="field-input"
                    type="number"
                    step="0.01"
                    placeholder="Price"
                    value={line.unit_price_cents}
                    onChange={(e) => updateBookingLine(i, { unit_price_cents: e.target.value })}
                    style={{ width: 90 }}
                  />
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => setBookingLines(bookingLines.filter((_, idx) => idx !== i))}
                    disabled={bookingLines.length === 1}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setBookingLines([...bookingLines, { ...EMPTY_LINE }])}
                style={{ marginTop: 4 }}
              >
                + Add treatment
              </button>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="submit" className="btn btn-primary" disabled={bookingWorking}>
                  Create booking
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeBookingModal}>
                  Cancel
                </button>
              </div>
              {bookingError && <p className="error-text">{bookingError}</p>}
            </form>
          </Modal>
        )}
      </main>
    </ModuleShell>
  );
}
