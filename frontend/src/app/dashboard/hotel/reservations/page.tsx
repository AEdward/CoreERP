"use client";

import { Fragment, useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { Modal } from "@/components/Modal";
import { IconPlus } from "@/components/icons";
import {
  api,
  ApiError,
  type Customer,
  type FolioCharge,
  type GuestFolio,
  type Reservation,
  type Room,
  type RoomType,
  type SuggestedRate,
  type TravelAgency,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";

const EMPTY_RESERVATION_FORM = {
  guest: "",
  room_type: "",
  room: "",
  source: "walk_in" as Reservation["source"],
  travel_agency: "",
  check_in_date: "",
  check_out_date: "",
  adults: "1",
  children: "0",
};

const EMPTY_CHARGE_FORM = { source_module: "misc" as FolioCharge["source_module"], description: "", amount_cents: "" };

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const STATUS_BADGE: Record<Reservation["status"], string> = {
  confirmed: "badge-gold",
  checked_in: "badge-green",
  checked_out: "badge-gray",
  cancelled: "badge-red",
  no_show: "badge-red",
};

export default function ReservationsPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [guests, setGuests] = useState<Customer[] | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomType[] | null>(null);
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [folios, setFolios] = useState<GuestFolio[] | null>(null);
  const [travelAgencies, setTravelAgencies] = useState<TravelAgency[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_RESERVATION_FORM);
  const [working, setWorking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [suggestedRate, setSuggestedRate] = useState<SuggestedRate | null>(null);
  const [showReservationModal, setShowReservationModal] = useState(false);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [chargeForm, setChargeForm] = useState(EMPTY_CHARGE_FORM);
  const [chargeWorking, setChargeWorking] = useState(false);
  const [chargeError, setChargeError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [transferRoomTarget, setTransferRoomTarget] = useState<Record<number, { room: string; reason: string }>>({});

  async function loadAll() {
    try {
      const [r, g, rt, rm, f, ta] = await Promise.all([
        api.listReservations(),
        api.listCustomers(),
        api.listRoomTypes(),
        api.listRooms(),
        api.listFolios(),
        api.listTravelAgencies(),
      ]);
      setReservations(r);
      setGuests(g);
      setRoomTypes(rt);
      setRooms(rm);
      setFolios(f);
      setTravelAgencies(ta);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load reservations.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  // Smart Pricing preview: refetches the suggested rate whenever the
  // in-progress booking's room type or dates change, so front desk sees
  // the number (and why) before submitting.
  useEffect(() => {
    if (!form.room_type || !form.check_in_date || !form.check_out_date) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestedRate(null);
      return;
    }
    let cancelled = false;
    api
      .getSuggestedRate(Number(form.room_type), form.check_in_date, form.check_out_date)
      .then((result) => {
        if (!cancelled) setSuggestedRate(result);
      })
      .catch(() => {
        if (!cancelled) setSuggestedRate(null);
      });
    return () => {
      cancelled = true;
    };
  }, [form.room_type, form.check_in_date, form.check_out_date]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setFormError(null);
    try {
      await api.createReservation({
        guest: Number(form.guest),
        room_type: Number(form.room_type),
        room: form.room ? Number(form.room) : null,
        source: form.source,
        travel_agency: form.source === "travel_agency" && form.travel_agency ? Number(form.travel_agency) : null,
        check_in_date: form.check_in_date,
        check_out_date: form.check_out_date,
        adults: Number(form.adults || 1),
        children: Number(form.children || 0),
      });
      setForm(EMPTY_RESERVATION_FORM);
      setShowReservationModal(false);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create reservation.");
    } finally {
      setWorking(false);
    }
  }

  function startAddReservation() {
    setForm(EMPTY_RESERVATION_FORM);
    setFormError(null);
    setShowReservationModal(true);
  }

  function closeReservationModal() {
    setShowReservationModal(false);
    setForm(EMPTY_RESERVATION_FORM);
    setFormError(null);
  }

  async function handleAssignRoom(reservationId: number, roomId: string) {
    if (!roomId) return;
    setActionError(null);
    try {
      await api.assignReservationRoom(reservationId, Number(roomId));
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to assign room.");
    }
  }

  async function handleCheckIn(id: number) {
    setActionError(null);
    try {
      await api.checkInReservation(id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to check in.");
    }
  }

  async function handleCheckOut(id: number) {
    setActionError(null);
    try {
      await api.checkOutReservation(id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to check out.");
    }
  }

  async function handleCancel(id: number) {
    setActionError(null);
    try {
      await api.cancelReservation(id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to cancel.");
    }
  }

  async function handleTransferRoom(id: number, room: number, reason: string) {
    setActionError(null);
    try {
      await api.transferReservationRoom(id, room, reason);
      setTransferRoomTarget({});
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to transfer room.");
    }
  }

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
  const guestName = (id: number) => guests?.find((g) => g.id === id)?.name ?? "—";
  const availableRooms = (roomTypeId: number) =>
    rooms?.filter((r) => r.room_type === roomTypeId && r.status === "available") ?? [];
  const folioFor = (reservationId: number) => folios?.find((f) => f.reservation === reservationId) ?? null;

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <h1 className="page-title">Reservations — {activeMembership?.company.name}</h1>
          {canManage && (
            <button type="button" className="btn btn-primary" style={{ flexShrink: 0 }} onClick={startAddReservation}>
              <IconPlus size={16} />
              New reservation
            </button>
          )}
        </div>
        {loadError && <p className="error-text">{loadError}</p>}
        {actionError && <p className="error-text">{actionError}</p>}

        <section style={{ marginTop: 20, marginBottom: 40 }}>
          <h2 className="section-label">All reservations</h2>
          <div className="panel">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Confirmation</th>
                    <th>Guest</th>
                    <th>Room</th>
                    <th>Dates</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {reservations?.map((r) => {
                    const folio = folioFor(r.id);
                    const isExpanded = expandedId === r.id;
                    return (
                      <Fragment key={r.id}>
                        <tr>
                          <td>{r.confirmation_number}</td>
                          <td>
                            {r.guest_name || guestName(r.guest)}
                            {r.status === "confirmed" &&
                              !guests?.find((g) => g.id === r.guest)?.is_registered && (
                                <div style={{ fontSize: 11, color: "#c60" }}>ID not registered</div>
                              )}
                          </td>
                          <td>
                            {r.room_number ? (
                              `Room ${r.room_number}`
                            ) : canManage && r.status === "confirmed" ? (
                              <select
                                className="field-select"
                                value=""
                                onChange={(e) => handleAssignRoom(r.id, e.target.value)}
                              >
                                <option value="">Assign room…</option>
                                {availableRooms(r.room_type).map((room) => (
                                  <option key={room.id} value={room.id}>
                                    Room {room.number}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              "Unassigned"
                            )}
                          </td>
                          <td>
                            {r.check_in_date} → {r.check_out_date}
                          </td>
                          <td>
                            <span className={`badge ${STATUS_BADGE[r.status]}`}>{r.status.replace("_", " ")}</span>
                          </td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            {canManage && r.status === "confirmed" && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleCheckIn(r.id)}
                                style={{ marginRight: 4 }}
                              >
                                Check in
                              </button>
                            )}
                            {canManage && r.status === "checked_in" && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleCheckOut(r.id)}
                                style={{ marginRight: 4 }}
                              >
                                Check out
                              </button>
                            )}
                            {canManage && r.status === "confirmed" && (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => handleCancel(r.id)}
                                style={{ marginRight: 4 }}
                              >
                                Cancel
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setExpandedId(isExpanded ? null : r.id)}
                            >
                              {isExpanded ? "Hide folio" : "View folio"}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} style={{ padding: "12px", background: "var(--brand-ivory)" }}>
                          {!folio ? (
                            <p style={{ color: "#999", margin: 0 }}>No folio found for this reservation.</p>
                          ) : (
                            <div>
                              <strong>
                                Folio — {folio.status} — balance {formatCents(folio.balance_cents)}
                              </strong>
                              {r.travel_agency && (
                                <p style={{ fontSize: 12, color: "#666", margin: "4px 0" }}>
                                  Booked via {r.travel_agency_name}
                                  {r.status === "checked_out" &&
                                    ` — commission ${formatCents(r.commission_cents)}`}
                                </p>
                              )}
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
                                      <td style={{ color: "#999" }}>{formatCents(c.tax_amount_cents)}</td>
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
                                  style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}
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
                                    style={{ flex: 1 }}
                                  />
                                  <input
                                    className="field-input"
                                    type="number"
                                    step="0.01"
                                    placeholder="Amount"
                                    required
                                    value={chargeForm.amount_cents}
                                    onChange={(e) => setChargeForm({ ...chargeForm, amount_cents: e.target.value })}
                                    style={{ width: 100 }}
                                  />
                                  <button type="submit" className="btn btn-primary btn-sm" disabled={chargeWorking}>
                                    Add charge
                                  </button>
                                </form>
                              )}
                              {chargeError && <p className="error-text" style={{ fontSize: 12 }}>{chargeError}</p>}

                              <strong style={{ display: "block", marginTop: 16 }}>Room Transfers</strong>
                              {r.room_transfers.length === 0 ? (
                                <p style={{ color: "#999", fontSize: 12, margin: "4px 0" }}>None yet.</p>
                              ) : (
                                <ul style={{ fontSize: 12, margin: "4px 0", paddingLeft: 18 }}>
                                  {r.room_transfers.map((t) => (
                                    <li key={t.id}>
                                      Room {t.from_room_number} → Room {t.to_room_number}
                                      {t.reason ? ` (${t.reason})` : ""} —{" "}
                                      {new Date(t.created_at).toLocaleString()}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {canManage && r.status === "checked_in" && (
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    const target = transferRoomTarget[r.id];
                                    if (target?.room) {
                                      handleTransferRoom(r.id, Number(target.room), target.reason ?? "");
                                    }
                                  }}
                                  style={{ marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}
                                >
                                  <select
                                    className="field-select"
                                    value={transferRoomTarget[r.id]?.room ?? ""}
                                    onChange={(e) =>
                                      setTransferRoomTarget({
                                        ...transferRoomTarget,
                                        [r.id]: { ...transferRoomTarget[r.id], room: e.target.value, reason: transferRoomTarget[r.id]?.reason ?? "" },
                                      })
                                    }
                                  >
                                    <option value="">Move to room…</option>
                                    {rooms
                                      ?.filter((room) => room.id !== r.room)
                                      .map((room) => (
                                        <option key={room.id} value={room.id}>
                                          Room {room.number}
                                        </option>
                                      ))}
                                  </select>
                                  <input
                                    className="field-input"
                                    placeholder="Reason (optional)"
                                    value={transferRoomTarget[r.id]?.reason ?? ""}
                                    onChange={(e) =>
                                      setTransferRoomTarget({
                                        ...transferRoomTarget,
                                        [r.id]: { room: transferRoomTarget[r.id]?.room ?? "", reason: e.target.value },
                                      })
                                    }
                                    style={{ flex: 1 }}
                                  />
                                  <button
                                    type="submit"
                                    className="btn btn-primary btn-sm"
                                    disabled={!transferRoomTarget[r.id]?.room}
                                  >
                                    Transfer
                                  </button>
                                </form>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {reservations?.length === 0 && (
                <tr className="empty-row">
                  <td colSpan={6}>No reservations yet.</td>
                </tr>
              )}
            </tbody>
          </table>
            </div>
          </div>
        </section>

        {canManage && showReservationModal && (
          <Modal title="New reservation" onClose={closeReservationModal}>
            <form
              onSubmit={handleCreate}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10,
              }}
            >
              <div>
                <select
                  className="field-select"
                  required
                  value={form.guest}
                  onChange={(e) => setForm({ ...form, guest: e.target.value })}
                  style={{ width: "100%" }}
                >
                  <option value="">Guest…</option>
                  {guests?.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                {guests?.length === 0 && (
                  <p style={{ fontSize: 12, color: "#c60", margin: "4px 0 0" }}>
                    No guests yet — add one in <a href="/dashboard/hotel/guest-directory">Guest Directory</a> first.
                  </p>
                )}
              </div>
              <div>
                <select
                  className="field-select"
                  required
                  value={form.room_type}
                  onChange={(e) => setForm({ ...form, room_type: e.target.value, room: "" })}
                  style={{ width: "100%" }}
                >
                  <option value="">Room type…</option>
                  {roomTypes?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({formatCents(t.base_rate_cents)}/night)
                    </option>
                  ))}
                </select>
                {roomTypes?.length === 0 && (
                  <p style={{ fontSize: 12, color: "#c60", margin: "4px 0 0" }}>
                    No room types configured — add one in <a href="/dashboard/hotel/settings">Front Office Settings</a> first.
                  </p>
                )}
              </div>
              <select
                className="field-select"
                value={form.room}
                onChange={(e) => setForm({ ...form, room: e.target.value })}
                disabled={!form.room_type}
              >
                <option value="">Assign room later</option>
                {availableRooms(Number(form.room_type)).map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.number}
                  </option>
                ))}
              </select>
              <select
                className="field-select"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value as Reservation["source"] })}
              >
                <option value="walk_in">Walk-in</option>
                <option value="website">Website</option>
                <option value="phone">Phone</option>
                <option value="travel_agency">Travel Agency</option>
              </select>
              {form.source === "travel_agency" && (
                <select
                  className="field-select"
                  required
                  value={form.travel_agency}
                  onChange={(e) => setForm({ ...form, travel_agency: e.target.value })}
                >
                  <option value="">Travel agency…</option>
                  {travelAgencies?.map((ta) => (
                    <option key={ta.id} value={ta.id}>
                      {ta.name}
                    </option>
                  ))}
                </select>
              )}
              <input
                className="field-input"
                type="date"
                required
                value={form.check_in_date}
                onChange={(e) => setForm({ ...form, check_in_date: e.target.value })}
              />
              <input
                className="field-input"
                type="date"
                required
                value={form.check_out_date}
                onChange={(e) => setForm({ ...form, check_out_date: e.target.value })}
              />
              <input
                className="field-input"
                type="number"
                min={1}
                placeholder="Adults"
                value={form.adults}
                onChange={(e) => setForm({ ...form, adults: e.target.value })}
              />
              <input
                className="field-input"
                type="number"
                min={0}
                placeholder="Children"
                value={form.children}
                onChange={(e) => setForm({ ...form, children: e.target.value })}
              />
              {suggestedRate && (
                <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: 13, color: "#666" }}>
                  Suggested rate (Smart Pricing): {formatCents(suggestedRate.suggested_rate_cents)}
                  {suggestedRate.seasonal_rate_name && ` — ${suggestedRate.seasonal_rate_name} rate`}
                  {suggestedRate.surge_percent > 0 &&
                    ` — +${suggestedRate.surge_percent}% occupancy surge (${suggestedRate.occupancy_percent}% booked)`}
                </p>
              )}
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={working || !form.guest || !form.room_type || !form.check_in_date || !form.check_out_date}
                >
                  Create reservation
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeReservationModal}>
                  Cancel
                </button>
              </div>
              {formError && (
                <p className="error-text" style={{ gridColumn: "1 / -1", margin: 0 }}>{formError}</p>
              )}
            </form>
          </Modal>
        )}
      </main>
    </ModuleShell>
  );
}
