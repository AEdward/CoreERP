"use client";

import { Fragment, useEffect, useState } from "react";
import { EMPTY_LINE, LineItemsEditor, type LineItemRow } from "@/components/LineItemsEditor";
import { Modal } from "@/components/Modal";
import { ModuleShell } from "@/components/ModuleShell";
import { IconPlus } from "@/components/icons";
import {
  api,
  ApiError,
  type ConferenceBooking,
  type ConferenceEventType,
  type ConferenceHall,
  type ConferenceSeatingPlan,
  type Item,
  type Reservation,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";

const EMPTY_HALL_FORM = { name: "", capacity: "50", day_rate_cents: "" };
const EMPTY_BOOKING_FORM = {
  hall: "",
  event_name: "",
  event_type: "corporate" as ConferenceEventType,
  seating_plan: "theater" as ConferenceSeatingPlan,
  attendees: "1",
  start_at: "",
  end_at: "",
  reservation: "",
};
const EMPTY_ADD_LINE = { item: "", quantity: "1", unit_price_cents: "" };

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const STATUS_BADGE: Record<ConferenceBooking["status"], string> = {
  open: "badge-gold",
  paid: "badge-green",
  charged_to_room: "badge-green",
  cancelled: "badge-red",
};

export default function ConferencePage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [halls, setHalls] = useState<ConferenceHall[] | null>(null);
  const [bookings, setBookings] = useState<ConferenceBooking[] | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [hallForm, setHallForm] = useState(EMPTY_HALL_FORM);
  const [hallWorking, setHallWorking] = useState(false);
  const [showHallModal, setShowHallModal] = useState(false);

  const [bookingForm, setBookingForm] = useState(EMPTY_BOOKING_FORM);
  const [bookingLines, setBookingLines] = useState<LineItemRow[]>([{ ...EMPTY_LINE }]);
  const [bookingWorking, setBookingWorking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [addLineForm, setAddLineForm] = useState(EMPTY_ADD_LINE);
  const [addLineWorking, setAddLineWorking] = useState(false);

  async function loadAll() {
    try {
      const [h, b, i, r] = await Promise.all([
        api.listConferenceHalls(),
        api.listConferenceBookings(),
        api.listItems(),
        api.listReservations(),
      ]);
      setHalls(h);
      setBookings(b);
      setItems(i);
      setReservations(r);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load conference data.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAddHall(e: React.FormEvent) {
    e.preventDefault();
    setHallWorking(true);
    try {
      await api.createConferenceHall({
        name: hallForm.name,
        capacity: Number(hallForm.capacity || 1),
        day_rate_cents: Math.round(Number(hallForm.day_rate_cents || 0) * 100),
      });
      setHallForm(EMPTY_HALL_FORM);
      setShowHallModal(false);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to add hall.");
    } finally {
      setHallWorking(false);
    }
  }

  function startAddHall() {
    setHallForm(EMPTY_HALL_FORM);
    setLoadError(null);
    setShowHallModal(true);
  }

  function closeHallModal() {
    setShowHallModal(false);
    setHallForm(EMPTY_HALL_FORM);
  }

  async function handleCreateBooking(e: React.FormEvent) {
    e.preventDefault();
    setBookingWorking(true);
    setBookingError(null);
    try {
      await api.createConferenceBooking({
        hall: Number(bookingForm.hall),
        event_name: bookingForm.event_name,
        event_type: bookingForm.event_type,
        seating_plan: bookingForm.seating_plan,
        attendees: Number(bookingForm.attendees || 1),
        start_at: bookingForm.start_at ? new Date(bookingForm.start_at).toISOString() : "",
        end_at: bookingForm.end_at ? new Date(bookingForm.end_at).toISOString() : "",
        reservation: bookingForm.reservation ? Number(bookingForm.reservation) : null,
        lines: bookingLines
          .filter((l) => l.item && l.quantity)
          .map((l) => ({
            item: Number(l.item),
            quantity: Number(l.quantity),
            unit_price_cents: Math.round(Number(l.unitPrice || 0) * 100),
          })),
      });
      setBookingForm(EMPTY_BOOKING_FORM);
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
    setBookingForm(EMPTY_BOOKING_FORM);
    setBookingLines([{ ...EMPTY_LINE }]);
    setBookingError(null);
    setShowBookingModal(true);
  }

  function closeBookingModal() {
    setShowBookingModal(false);
    setBookingForm(EMPTY_BOOKING_FORM);
    setBookingLines([{ ...EMPTY_LINE }]);
    setBookingError(null);
  }

  async function handleBookingAction(id: number, action: "chargeConferenceBookingToRoom" | "markConferenceBookingPaid" | "cancelConferenceBooking") {
    setActionError(null);
    try {
      await api[action](id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update booking.");
    }
  }

  async function handleAddLine(e: React.FormEvent, bookingId: number) {
    e.preventDefault();
    setAddLineWorking(true);
    setActionError(null);
    try {
      await api.addConferenceBookingLine({
        booking: bookingId,
        item: Number(addLineForm.item),
        quantity: Number(addLineForm.quantity || 1),
        unit_price_cents: Math.round(Number(addLineForm.unit_price_cents || 0) * 100),
      });
      setAddLineForm(EMPTY_ADD_LINE);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to add item.");
    } finally {
      setAddLineWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("conference.manage") ?? false;
  const openReservations = reservations?.filter((r) => r.status === "checked_in") ?? [];

  return (
    <ModuleShell moduleKey="conference" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1150, margin: "40px auto", padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <h1 className="page-title">Conference Hall / Wedding Hall — {activeMembership?.company.name}</h1>
          {canManage && (
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button type="button" className="btn btn-secondary" onClick={startAddHall}>
                <IconPlus size={16} />
                Add hall
              </button>
              <button type="button" className="btn btn-primary" onClick={startAddBooking}>
                <IconPlus size={16} />
                New booking
              </button>
            </div>
          )}
        </div>
        {loadError && <p className="error-text">{loadError}</p>}
        {actionError && <p className="error-text">{actionError}</p>}

        {/* Halls */}
        <section style={{ marginTop: 20 }}>
          <h2 className="section-label">Halls</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
            {halls?.map((h) => (
              <div key={h.id} className="panel" style={{ padding: "8px 14px", fontSize: 13 }}>
                <strong>{h.name}</strong> — capacity {h.capacity}, {formatCents(h.day_rate_cents)}/day
              </div>
            ))}
            {halls?.length === 0 && <p style={{ color: "#999", fontSize: 13 }}>No halls yet.</p>}
          </div>
        </section>

        {/* Bookings */}
        <section style={{ marginTop: 32, marginBottom: 40 }}>
          <h2 className="section-label">Bookings</h2>
          <div className="panel" style={{ marginTop: 8 }}>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Hall</th>
                    <th>When</th>
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
                          <td>
                            {b.event_name} <span style={{ color: "#999" }}>({b.event_type})</span>
                          </td>
                          <td>{b.hall_name}</td>
                          <td>{new Date(b.start_at).toLocaleString()}</td>
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
                                    onClick={() => handleBookingAction(b.id, "chargeConferenceBookingToRoom")}
                                    style={{ marginRight: 4 }}
                                  >
                                    Charge to room
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleBookingAction(b.id, "markConferenceBookingPaid")}
                                  style={{ marginRight: 4 }}
                                >
                                  Mark paid
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleBookingAction(b.id, "cancelConferenceBooking")}
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
                              {isExpanded ? "Hide details" : "View details"}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} style={{ padding: 12, background: "var(--brand-ivory)" }}>
                              <p style={{ margin: "0 0 8px", fontSize: 13 }}>
                                {b.seating_plan.replace("_", "-")} seating, {b.attendees} attendees, hall rate {formatCents(b.hall_rate_cents)}
                              </p>
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>Item</th>
                                    <th>Qty</th>
                                    <th>Price</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {b.lines.map((l) => (
                                    <tr key={l.id}>
                                      <td>{l.item_name}</td>
                                      <td>{l.quantity}</td>
                                      <td>{formatCents(l.line_total_cents)}</td>
                                    </tr>
                                  ))}
                                  {b.lines.length === 0 && (
                                    <tr className="empty-row">
                                      <td colSpan={3}>No catering/equipment added.</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                              {canManage && b.status === "open" && (
                                <form
                                  onSubmit={(e) => handleAddLine(e, b.id)}
                                  style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}
                                >
                                  <select
                                    className="field-select"
                                    value={addLineForm.item}
                                    onChange={(e) => setAddLineForm({ ...addLineForm, item: e.target.value })}
                                  >
                                    <option value="">Item…</option>
                                    {items?.map((it) => (
                                      <option key={it.id} value={it.id}>
                                        {it.name}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    className="field-input"
                                    type="number"
                                    min={1}
                                    placeholder="Qty"
                                    value={addLineForm.quantity}
                                    onChange={(e) => setAddLineForm({ ...addLineForm, quantity: e.target.value })}
                                    style={{ width: 70 }}
                                  />
                                  <input
                                    className="field-input"
                                    type="number"
                                    step="0.01"
                                    placeholder="Unit price"
                                    value={addLineForm.unit_price_cents}
                                    onChange={(e) => setAddLineForm({ ...addLineForm, unit_price_cents: e.target.value })}
                                    style={{ width: 100 }}
                                  />
                                  <button
                                    type="submit"
                                    className="btn btn-primary btn-sm"
                                    disabled={addLineWorking || !addLineForm.item}
                                  >
                                    Add item
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
                      <td colSpan={7}>No bookings yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {canManage && showHallModal && (
          <Modal title="Add hall" onClose={closeHallModal}>
            <form onSubmit={handleAddHall} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                className="field-input"
                placeholder="Hall name"
                required
                value={hallForm.name}
                onChange={(e) => setHallForm({ ...hallForm, name: e.target.value })}
              />
              <input
                className="field-input"
                type="number"
                min={1}
                placeholder="Capacity"
                value={hallForm.capacity}
                onChange={(e) => setHallForm({ ...hallForm, capacity: e.target.value })}
                style={{ width: 100 }}
              />
              <input
                className="field-input"
                type="number"
                step="0.01"
                placeholder="Day rate"
                value={hallForm.day_rate_cents}
                onChange={(e) => setHallForm({ ...hallForm, day_rate_cents: e.target.value })}
                style={{ width: 110 }}
              />
              <div style={{ width: "100%", display: "flex", gap: 8, marginTop: 4 }}>
                <button type="submit" className="btn btn-primary" disabled={hallWorking || !hallForm.name}>
                  Add hall
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeHallModal}>
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        )}

        {canManage && showBookingModal && (
          <Modal title="New booking" onClose={closeBookingModal}>
            <form onSubmit={handleCreateBooking}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <select
                  className="field-select"
                  value={bookingForm.hall}
                  onChange={(e) => setBookingForm({ ...bookingForm, hall: e.target.value })}
                  style={{ flex: 1 }}
                  required
                >
                  <option value="">Hall…</option>
                  {halls?.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
                <input
                  className="field-input"
                  placeholder="Event name"
                  required
                  value={bookingForm.event_name}
                  onChange={(e) => setBookingForm({ ...bookingForm, event_name: e.target.value })}
                  style={{ flex: 1 }}
                />
                <select
                  className="field-select"
                  value={bookingForm.event_type}
                  onChange={(e) => setBookingForm({ ...bookingForm, event_type: e.target.value as ConferenceEventType })}
                >
                  <option value="corporate">Corporate</option>
                  <option value="wedding">Wedding</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <select
                  className="field-select"
                  value={bookingForm.seating_plan}
                  onChange={(e) => setBookingForm({ ...bookingForm, seating_plan: e.target.value as ConferenceSeatingPlan })}
                >
                  <option value="theater">Theater</option>
                  <option value="classroom">Classroom</option>
                  <option value="banquet">Banquet</option>
                  <option value="u_shape">U-shape</option>
                  <option value="boardroom">Boardroom</option>
                </select>
                <input
                  className="field-input"
                  type="number"
                  min={1}
                  placeholder="Attendees"
                  value={bookingForm.attendees}
                  onChange={(e) => setBookingForm({ ...bookingForm, attendees: e.target.value })}
                  style={{ width: 100 }}
                />
                <input
                  className="field-input"
                  type="datetime-local"
                  value={bookingForm.start_at}
                  onChange={(e) => setBookingForm({ ...bookingForm, start_at: e.target.value })}
                  required
                />
                <input
                  className="field-input"
                  type="datetime-local"
                  value={bookingForm.end_at}
                  onChange={(e) => setBookingForm({ ...bookingForm, end_at: e.target.value })}
                  required
                />
                <select
                  className="field-select"
                  value={bookingForm.reservation}
                  onChange={(e) => setBookingForm({ ...bookingForm, reservation: e.target.value })}
                  style={{ flex: 1 }}
                >
                  <option value="">No room charge</option>
                  {openReservations.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.confirmation_number} — {r.guest_name} (Room {r.room_number})
                    </option>
                  ))}
                </select>
              </div>
              <p className="field-label" style={{ margin: "4px 0 8px" }}>Catering / equipment</p>
              <LineItemsEditor items={items ?? []} rows={bookingLines} onChange={setBookingLines} priceLabel="Unit price" />
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
