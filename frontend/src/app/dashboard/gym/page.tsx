"use client";

import { Fragment, useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { ModuleShell } from "@/components/ModuleShell";
import { IconPlus } from "@/components/icons";
import {
  api,
  ApiError,
  type GymBooking,
  type GymMembership,
  type GymPlanType,
  type Item,
  type Reservation,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";

const EMPTY_MEMBERSHIP_FORM = { plan_type: "monthly" as GymPlanType, start_date: "", end_date: "", price_cents: "" };
const EMPTY_LINE = { activity: "", duration_minutes: "60", scheduled_at: "", quantity: "1", unit_price_cents: "" };
const EMPTY_ADD_LINE = { ...EMPTY_LINE };

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const MEMBERSHIP_STATUS_LABELS: Record<GymMembership["membership_status"], string> = {
  pending: "Pending",
  active: "Active",
  expired: "Expired",
  cancelled: "Cancelled",
};

const MEMBERSHIP_STATUS_BADGE: Record<GymMembership["membership_status"], string> = {
  pending: "badge-gray",
  active: "badge-green",
  expired: "badge-red",
  cancelled: "badge-red",
};

const BILLING_BADGE: Record<GymMembership["status"], string> = {
  open: "badge-gold",
  paid: "badge-green",
  charged_to_room: "badge-green",
  cancelled: "badge-red",
};

const ACTIVITY_LABELS: Record<GymBooking["lines"][number]["status"], string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const ACTIVITY_BADGE: Record<GymBooking["lines"][number]["status"], string> = {
  scheduled: "badge-gray",
  in_progress: "badge-gold",
  completed: "badge-green",
  cancelled: "badge-red",
};

export default function GymPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [memberships, setMemberships] = useState<GymMembership[] | null>(null);
  const [bookings, setBookings] = useState<GymBooking[] | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [membershipForm, setMembershipForm] = useState(EMPTY_MEMBERSHIP_FORM);
  const [membershipWorking, setMembershipWorking] = useState(false);
  const [membershipError, setMembershipError] = useState<string | null>(null);

  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingReservation, setBookingReservation] = useState("");
  const [bookingLines, setBookingLines] = useState([{ ...EMPTY_LINE }]);
  const [bookingWorking, setBookingWorking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [addLineForm, setAddLineForm] = useState(EMPTY_ADD_LINE);
  const [addLineWorking, setAddLineWorking] = useState(false);

  async function loadAll() {
    try {
      const [m, b, i, r] = await Promise.all([
        api.listGymMemberships(),
        api.listGymBookings(),
        api.listItems(),
        api.listReservations(),
      ]);
      setMemberships(m);
      setBookings(b);
      setItems(i);
      setReservations(r);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load gym data.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleCreateMembership(e: React.FormEvent) {
    e.preventDefault();
    setMembershipWorking(true);
    setMembershipError(null);
    try {
      await api.createGymMembership({
        plan_type: membershipForm.plan_type,
        start_date: membershipForm.start_date,
        end_date: membershipForm.end_date,
        price_cents: Math.round(Number(membershipForm.price_cents || 0) * 100),
      });
      setShowMembershipModal(false);
      setMembershipForm(EMPTY_MEMBERSHIP_FORM);
      await loadAll();
    } catch (err) {
      setMembershipError(err instanceof ApiError ? err.message : "Failed to create membership.");
    } finally {
      setMembershipWorking(false);
    }
  }

  function startAddMembership() {
    setMembershipForm(EMPTY_MEMBERSHIP_FORM);
    setMembershipError(null);
    setShowMembershipModal(true);
  }

  function closeMembershipModal() {
    setShowMembershipModal(false);
    setMembershipError(null);
  }

  async function handleMembershipAction(id: number, action: "chargeGymMembershipToRoom" | "markGymMembershipPaid" | "cancelGymMembership") {
    setActionError(null);
    try {
      await api[action](id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update membership.");
    }
  }

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
      await api.createGymBooking({
        reservation: bookingReservation ? Number(bookingReservation) : null,
        lines: bookingLines
          .filter((l) => l.activity && l.quantity)
          .map((l) => ({
            activity: Number(l.activity),
            duration_minutes: Number(l.duration_minutes || 60),
            scheduled_at: l.scheduled_at ? new Date(l.scheduled_at).toISOString() : null,
            quantity: Number(l.quantity),
            unit_price_cents: Math.round(Number(l.unit_price_cents || 0) * 100),
          })),
      });
      setShowBookingModal(false);
      setBookingReservation("");
      setBookingLines([{ ...EMPTY_LINE }]);
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
    setBookingError(null);
  }

  async function handleActivity(lineId: number, action: "startGymActivity" | "completeGymActivity" | "cancelGymActivity") {
    setActionError(null);
    try {
      await api[action](lineId);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update activity.");
    }
  }

  async function handleBookingAction(id: number, action: "chargeGymBookingToRoom" | "markGymBookingPaid" | "cancelGymBooking") {
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
      await api.addGymBookingLine({
        booking: bookingId,
        activity: Number(addLineForm.activity),
        duration_minutes: Number(addLineForm.duration_minutes || 60),
        scheduled_at: addLineForm.scheduled_at ? new Date(addLineForm.scheduled_at).toISOString() : null,
        quantity: Number(addLineForm.quantity || 1),
        unit_price_cents: Math.round(Number(addLineForm.unit_price_cents || 0) * 100),
      });
      setAddLineForm({ ...EMPTY_ADD_LINE });
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to add activity.");
    } finally {
      setAddLineWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("gym.manage") ?? false;
  const openReservations = reservations?.filter((r) => r.status === "checked_in") ?? [];

  return (
    <ModuleShell moduleKey="gym" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1150, margin: "40px auto", padding: "0 16px 40px" }}>
        <div>
          <h1 className="page-title">Gym</h1>
          <p className="page-subtitle">{activeMembership?.company.name}</p>
        </div>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}
        {actionError && <p className="error-text" style={{ marginTop: 8 }}>{actionError}</p>}

        {/* Memberships */}
        <section style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <h2 className="section-label">Memberships</h2>
            {canManage && (
              <button type="button" className="btn btn-primary btn-sm" onClick={startAddMembership}>
                <IconPlus size={14} />
                Add membership
              </button>
            )}
          </div>
          <div className="panel" style={{ marginTop: 10 }}>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th>Dates</th>
                    <th>Price</th>
                    <th>Membership</th>
                    <th>Billing</th>
                    <th>Receipt</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {memberships?.map((m) => (
                    <tr key={m.id}>
                      <td style={{ textTransform: "capitalize" }}>{m.plan_type}</td>
                      <td>{m.start_date} → {m.end_date}</td>
                      <td>{formatCents(m.price_cents)}</td>
                      <td>
                        <span className={`badge ${MEMBERSHIP_STATUS_BADGE[m.membership_status]}`}>
                          {MEMBERSHIP_STATUS_LABELS[m.membership_status]}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${BILLING_BADGE[m.status]}`}>{m.status.replace(/_/g, " ")}</span>
                      </td>
                      <td>{m.receipt_number || "—"}</td>
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {canManage && m.status === "open" && (
                          <span style={{ display: "inline-flex", gap: 6 }}>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleMembershipAction(m.id, "markGymMembershipPaid")}>
                              Mark paid
                            </button>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => handleMembershipAction(m.id, "cancelGymMembership")}>
                              Cancel
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {memberships?.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={7}>No memberships yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {canManage && showMembershipModal && (
          <Modal title="Add membership" onClose={closeMembershipModal}>
            <form onSubmit={handleCreateMembership} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              <select
                className="field-select"
                value={membershipForm.plan_type}
                onChange={(e) => setMembershipForm({ ...membershipForm, plan_type: e.target.value as GymPlanType })}
              >
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
              <input
                className="field-input"
                type="date"
                title="Start date"
                value={membershipForm.start_date}
                onChange={(e) => setMembershipForm({ ...membershipForm, start_date: e.target.value })}
                required
              />
              <input
                className="field-input"
                type="date"
                title="End date"
                value={membershipForm.end_date}
                onChange={(e) => setMembershipForm({ ...membershipForm, end_date: e.target.value })}
                required
              />
              <input
                className="field-input"
                type="number"
                step="0.01"
                placeholder="Price"
                value={membershipForm.price_cents}
                onChange={(e) => setMembershipForm({ ...membershipForm, price_cents: e.target.value })}
                required
              />
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, marginTop: 4 }}>
                <button type="submit" className="btn btn-primary" disabled={membershipWorking}>
                  Add membership
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeMembershipModal}>
                  Cancel
                </button>
              </div>
              {membershipError && <p className="error-text" style={{ gridColumn: "1 / -1", margin: 0 }}>{membershipError}</p>}
            </form>
          </Modal>
        )}

        {/* Bookings */}
        <section style={{ marginTop: 32, marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <h2 className="section-label">Bookings (daily access / personal trainer)</h2>
            {canManage && (
              <button type="button" className="btn btn-primary btn-sm" onClick={startAddBooking}>
                <IconPlus size={14} />
                New booking
              </button>
            )}
          </div>
          <div className="panel" style={{ marginTop: 10 }}>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Room charge</th>
                    <th>Activities</th>
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
                            <span className={`badge ${BILLING_BADGE[b.status]}`}>{b.status.replace(/_/g, " ")}</span>
                          </td>
                          <td>{b.receipt_number || "—"}</td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              {canManage && b.status === "open" && (
                                <>
                                  {b.reservation && (
                                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleBookingAction(b.id, "chargeGymBookingToRoom")}>
                                      Charge to room
                                    </button>
                                  )}
                                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleBookingAction(b.id, "markGymBookingPaid")}>
                                    Mark paid
                                  </button>
                                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleBookingAction(b.id, "cancelGymBooking")}>
                                    Cancel
                                  </button>
                                </>
                              )}
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setExpandedId(isExpanded ? null : b.id)}>
                                {isExpanded ? "Hide activities" : "View activities"}
                              </button>
                            </span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} style={{ padding: 12, background: "var(--brand-ivory)" }}>
                              <table className="data-table">
                                <thead>
                                  <tr>
                                    <th>Activity</th>
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
                                      <td>{l.activity_name}</td>
                                      <td>{l.scheduled_at ? new Date(l.scheduled_at).toLocaleString() : "—"}</td>
                                      <td>{l.duration_minutes}</td>
                                      <td>{formatCents(l.line_total_cents)}</td>
                                      <td>
                                        <span className={`badge ${ACTIVITY_BADGE[l.status]}`}>{ACTIVITY_LABELS[l.status]}</span>
                                      </td>
                                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                        <span style={{ display: "inline-flex", gap: 6 }}>
                                          {canManage && l.status === "scheduled" && (
                                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleActivity(l.id, "startGymActivity")}>
                                              Start
                                            </button>
                                          )}
                                          {canManage && l.status === "in_progress" && (
                                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleActivity(l.id, "completeGymActivity")}>
                                              Complete
                                            </button>
                                          )}
                                          {canManage && (l.status === "scheduled" || l.status === "in_progress") && (
                                            <button type="button" className="btn btn-danger btn-sm" onClick={() => handleActivity(l.id, "cancelGymActivity")}>
                                              Cancel
                                            </button>
                                          )}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {canManage && b.status === "open" && (
                                <form
                                  onSubmit={(e) => handleAddLine(e, b.id)}
                                  style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}
                                >
                                  <select
                                    className="field-select"
                                    value={addLineForm.activity}
                                    onChange={(e) => setAddLineForm({ ...addLineForm, activity: e.target.value })}
                                    style={{ maxWidth: 200 }}
                                  >
                                    <option value="">Activity…</option>
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
                                    style={{ maxWidth: 200 }}
                                  />
                                  <input
                                    className="field-input"
                                    type="number"
                                    placeholder="Mins"
                                    value={addLineForm.duration_minutes}
                                    onChange={(e) => setAddLineForm({ ...addLineForm, duration_minutes: e.target.value })}
                                    style={{ width: 80 }}
                                  />
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
                                    placeholder="Price"
                                    value={addLineForm.unit_price_cents}
                                    onChange={(e) => setAddLineForm({ ...addLineForm, unit_price_cents: e.target.value })}
                                    style={{ width: 100 }}
                                  />
                                  <button
                                    type="submit"
                                    className="btn btn-primary btn-sm"
                                    disabled={addLineWorking || !addLineForm.activity}
                                  >
                                    Add activity
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
                      <td colSpan={6}>No gym bookings yet.</td>
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
                style={{ marginBottom: 10, maxWidth: 360 }}
              >
                <option value="">No room charge</option>
                {openReservations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.confirmation_number} — {r.guest_name} (Room {r.room_number})
                  </option>
                ))}
              </select>

              {bookingLines.map((line, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <select
                    className="field-select"
                    value={line.activity}
                    onChange={(e) => updateBookingLine(i, { activity: e.target.value })}
                    style={{ flex: 2, minWidth: 160 }}
                  >
                    <option value="">Activity…</option>
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
                    style={{ maxWidth: 200 }}
                  />
                  <input
                    className="field-input"
                    type="number"
                    placeholder="Mins"
                    value={line.duration_minutes}
                    onChange={(e) => updateBookingLine(i, { duration_minutes: e.target.value })}
                    style={{ width: 80 }}
                  />
                  <input
                    className="field-input"
                    type="number"
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={(e) => updateBookingLine(i, { quantity: e.target.value })}
                    style={{ width: 70 }}
                  />
                  <input
                    className="field-input"
                    type="number"
                    step="0.01"
                    placeholder="Price"
                    value={line.unit_price_cents}
                    onChange={(e) => updateBookingLine(i, { unit_price_cents: e.target.value })}
                    style={{ width: 100 }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
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
              >
                + Add activity
              </button>
              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button type="submit" className="btn btn-primary" disabled={bookingWorking}>
                  Create booking
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeBookingModal}>
                  Cancel
                </button>
              </div>
              {bookingError && <p className="error-text" style={{ marginTop: 8 }}>{bookingError}</p>}
            </form>
          </Modal>
        )}
      </main>
    </ModuleShell>
  );
}
