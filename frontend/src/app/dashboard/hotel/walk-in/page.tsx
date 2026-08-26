"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type Customer, type Reservation, type Room, type RoomType, type SuggestedRate } from "@/lib/api";
import { useSession } from "@/lib/useSession";

const EMPTY_FORM = {
  guest: "",
  room_type: "",
  room: "",
  check_in_date: new Date().toISOString().slice(0, 10),
  check_out_date: "",
  adults: "1",
  children: "0",
};

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function WalkInGuestsPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [guests, setGuests] = useState<Customer[] | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomType[] | null>(null);
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [working, setWorking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [suggestedRate, setSuggestedRate] = useState<SuggestedRate | null>(null);

  async function loadAll() {
    try {
      const [r, g, rt, rm] = await Promise.all([
        api.listReservations(),
        api.listCustomers(),
        api.listRoomTypes(),
        api.listRooms(),
      ]);
      setReservations(r);
      setGuests(g);
      setRoomTypes(rt);
      setRooms(rm);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load walk-in guests.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

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
        source: "walk_in",
        travel_agency: null,
        check_in_date: form.check_in_date,
        check_out_date: form.check_out_date,
        adults: Number(form.adults || 1),
        children: Number(form.children || 0),
      });
      setForm({ ...EMPTY_FORM, check_in_date: todayStr() });
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create the walk-in reservation.");
    } finally {
      setWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hotel.manage") ?? false;
  const availableRooms = (roomTypeId: number) =>
    rooms?.filter((r) => r.room_type === roomTypeId && r.status === "available") ?? [];
  const today = todayStr();
  const todaysWalkIns = (reservations ?? []).filter((r) => r.source === "walk_in" && r.check_in_date === today);

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1000, margin: "40px auto", padding: "0 16px 40px" }}>
        <h1 className="page-title">Walk-in Guests</h1>
        <p className="page-subtitle">Register a guest who arrived without a reservation.</p>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        {canManage && (
          <div className="panel" style={{ marginTop: 20 }}>
            <h2 className="section-label">New walk-in</h2>
            <form
              onSubmit={handleCreate}
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginTop: 10 }}
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
                <option value="">Assign room now…</option>
                {availableRooms(Number(form.room_type)).map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.number}
                  </option>
                ))}
              </select>
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
                <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: 13, color: "#6f6b5d" }}>
                  Suggested rate (Smart Pricing): {formatCents(suggestedRate.suggested_rate_cents)}
                  {suggestedRate.seasonal_rate_name && ` — ${suggestedRate.seasonal_rate_name} rate`}
                  {suggestedRate.surge_percent > 0 &&
                    ` — +${suggestedRate.surge_percent}% occupancy surge (${suggestedRate.occupancy_percent}% booked)`}
                </p>
              )}
              <div style={{ gridColumn: "1 / -1" }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={working || !form.guest || !form.room_type || !form.check_in_date || !form.check_out_date}
                >
                  Register walk-in
                </button>
              </div>
              {formError && <p className="error-text" style={{ gridColumn: "1 / -1", margin: 0 }}>{formError}</p>}
            </form>
          </div>
        )}

        <div className="panel" style={{ marginTop: 20 }}>
          <h2 className="section-label">Today&apos;s walk-ins</h2>
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Confirmation</th>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {todaysWalkIns.map((r) => (
                  <tr key={r.id}>
                    <td>{r.confirmation_number}</td>
                    <td style={{ fontWeight: 600 }}>{r.guest_name}</td>
                    <td>{r.room_number ? `Room ${r.room_number}` : "Unassigned"}</td>
                    <td>{r.status.replace("_", " ")}</td>
                  </tr>
                ))}
                {todaysWalkIns.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={4}>No walk-ins registered today yet.</td>
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
