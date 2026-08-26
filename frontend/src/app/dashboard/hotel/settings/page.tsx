"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import { IconPlus } from "@/components/icons";
import { api, ApiError, type Building, type Floor, type RoomType, type SeasonalRate } from "@/lib/api";
import { useSession } from "@/lib/useSession";

const EMPTY_ROOM_TYPE_FORM = { name: "", description: "", base_rate_cents: "", max_occupancy: "2", amenities: "" };
const EMPTY_SEASONAL_RATE_FORM = { room_type: "", name: "", start_date: "", end_date: "", rate_cents: "" };

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function FrontOfficeSettingsPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [buildings, setBuildings] = useState<Building[] | null>(null);
  const [floors, setFloors] = useState<Floor[] | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomType[] | null>(null);
  const [seasonalRates, setSeasonalRates] = useState<SeasonalRate[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [buildingName, setBuildingName] = useState("");
  const [buildingWorking, setBuildingWorking] = useState(false);
  const [showBuildingModal, setShowBuildingModal] = useState(false);

  const [floorForm, setFloorForm] = useState({ building: "", name: "", level: "0" });
  const [floorWorking, setFloorWorking] = useState(false);
  const [showFloorModal, setShowFloorModal] = useState(false);

  const [roomTypeForm, setRoomTypeForm] = useState(EMPTY_ROOM_TYPE_FORM);
  const [roomTypeWorking, setRoomTypeWorking] = useState(false);
  const [showRoomTypeModal, setShowRoomTypeModal] = useState(false);

  const [seasonalRateForm, setSeasonalRateForm] = useState(EMPTY_SEASONAL_RATE_FORM);
  const [seasonalRateWorking, setSeasonalRateWorking] = useState(false);
  const [editingSeasonalRateId, setEditingSeasonalRateId] = useState<number | null>(null);
  const [showSeasonalRateModal, setShowSeasonalRateModal] = useState(false);

  async function loadAll() {
    try {
      const [b, f, rt, sr] = await Promise.all([
        api.listBuildings(),
        api.listFloors(),
        api.listRoomTypes(),
        api.listSeasonalRates(),
      ]);
      setBuildings(b);
      setFloors(f);
      setRoomTypes(rt);
      setSeasonalRates(sr);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load settings.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAddBuilding(e: React.FormEvent) {
    e.preventDefault();
    setBuildingWorking(true);
    try {
      await api.createBuilding({ name: buildingName });
      setBuildingName("");
      setShowBuildingModal(false);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to add building.");
    } finally {
      setBuildingWorking(false);
    }
  }

  async function handleAddFloor(e: React.FormEvent) {
    e.preventDefault();
    setFloorWorking(true);
    try {
      await api.createFloor({
        building: Number(floorForm.building),
        name: floorForm.name,
        level: Number(floorForm.level || 0),
      });
      setFloorForm({ building: "", name: "", level: "0" });
      setShowFloorModal(false);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to add floor.");
    } finally {
      setFloorWorking(false);
    }
  }

  async function handleAddRoomType(e: React.FormEvent) {
    e.preventDefault();
    setRoomTypeWorking(true);
    try {
      await api.createRoomType({
        name: roomTypeForm.name,
        description: roomTypeForm.description,
        base_rate_cents: Math.round(Number(roomTypeForm.base_rate_cents || 0) * 100),
        max_occupancy: Number(roomTypeForm.max_occupancy || 2),
        amenities: roomTypeForm.amenities,
      });
      setRoomTypeForm(EMPTY_ROOM_TYPE_FORM);
      setShowRoomTypeModal(false);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to add room type.");
    } finally {
      setRoomTypeWorking(false);
    }
  }

  async function handleAddSeasonalRate(e: React.FormEvent) {
    e.preventDefault();
    setSeasonalRateWorking(true);
    try {
      const payload = {
        room_type: Number(seasonalRateForm.room_type),
        name: seasonalRateForm.name,
        start_date: seasonalRateForm.start_date,
        end_date: seasonalRateForm.end_date,
        rate_cents: Math.round(Number(seasonalRateForm.rate_cents || 0) * 100),
      };
      if (editingSeasonalRateId) {
        await api.updateSeasonalRate(editingSeasonalRateId, payload);
      } else {
        await api.createSeasonalRate(payload);
      }
      setSeasonalRateForm(EMPTY_SEASONAL_RATE_FORM);
      setEditingSeasonalRateId(null);
      setShowSeasonalRateModal(false);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save seasonal rate.");
    } finally {
      setSeasonalRateWorking(false);
    }
  }

  function startEditSeasonalRate(sr: SeasonalRate) {
    setEditingSeasonalRateId(sr.id);
    setSeasonalRateForm({
      room_type: String(sr.room_type),
      name: sr.name,
      start_date: sr.start_date,
      end_date: sr.end_date,
      rate_cents: (sr.rate_cents / 100).toString(),
    });
    setShowSeasonalRateModal(true);
  }

  function closeSeasonalRateModal() {
    setShowSeasonalRateModal(false);
    setEditingSeasonalRateId(null);
    setSeasonalRateForm(EMPTY_SEASONAL_RATE_FORM);
  }

  async function handleDeleteSeasonalRate(id: number) {
    try {
      await api.deleteSeasonalRate(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to delete seasonal rate.");
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("hotel.manage") ?? false;
  const floorLabel = (id: number) => {
    const floor = floors?.find((f) => f.id === id);
    const building = buildings?.find((b) => b.id === floor?.building);
    return floor ? `${building?.name ?? "?"} — ${floor.name}` : "—";
  };

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px 40px" }}>
        <h1 className="page-title">Front Office Settings</h1>
        <p className="page-subtitle">Room types, seasonal rates, buildings, and floors — the configuration behind Reservations and Room Status.</p>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        {/* Room Types */}
        <section style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <h2 className="section-label">Room Types</h2>
            {canManage && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowRoomTypeModal(true)}>
                <IconPlus size={14} />
                Add Room Type
              </button>
            )}
          </div>
          <div className="panel" style={{ marginTop: 10 }}>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Base rate</th>
                    <th>Max occupancy</th>
                    <th>Amenities</th>
                  </tr>
                </thead>
                <tbody>
                  {roomTypes?.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 600 }}>{t.name}</td>
                      <td>{formatCents(t.base_rate_cents)}</td>
                      <td>{t.max_occupancy}</td>
                      <td style={{ color: "#666" }}>{t.amenities || "—"}</td>
                    </tr>
                  ))}
                  {roomTypes?.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={4}>No room types yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Seasonal Rates */}
        <section style={{ marginTop: 32 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <h2 className="section-label">Seasonal Rates</h2>
              <p style={{ fontSize: 12, color: "#8a8577", margin: "4px 0 0" }}>
                Calendar overrides for a room type&apos;s base rate — Smart Pricing layers an automatic occupancy
                surge on top of whichever of these applies.
              </p>
            </div>
            {canManage && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowSeasonalRateModal(true)}>
                <IconPlus size={14} />
                Add Seasonal Rate
              </button>
            )}
          </div>
          <div className="panel" style={{ marginTop: 10 }}>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Room type</th>
                    <th>Name</th>
                    <th>Dates</th>
                    <th>Rate</th>
                    {canManage && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {seasonalRates?.map((sr) => (
                    <tr key={sr.id}>
                      <td>{sr.room_type_name}</td>
                      <td>{sr.name}</td>
                      <td>
                        {sr.start_date} → {sr.end_date}
                      </td>
                      <td>{formatCents(sr.rate_cents)}</td>
                      {canManage && (
                        <td style={{ textAlign: "right" }}>
                          <RowActions
                            onEdit={() => startEditSeasonalRate(sr)}
                            onDelete={() => handleDeleteSeasonalRate(sr.id)}
                            disabled={seasonalRateWorking}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                  {seasonalRates?.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={5}>No seasonal rates yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Buildings & Floors */}
        <section style={{ marginTop: 32, marginBottom: 20, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div className="panel" style={{ flex: "1 1 300px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 className="section-label">Buildings</h2>
              {canManage && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowBuildingModal(true)}>
                  <IconPlus size={14} />
                  Add
                </button>
              )}
            </div>
            <ul style={{ marginTop: 10, paddingLeft: 18, fontSize: 14 }}>
              {buildings?.map((b) => <li key={b.id}>{b.name}</li>)}
              {buildings?.length === 0 && <li style={{ color: "#8a8577", listStyle: "none" }}>None yet.</li>}
            </ul>
          </div>

          <div className="panel" style={{ flex: "1 1 300px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 className="section-label">Floors</h2>
              {canManage && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowFloorModal(true)}>
                  <IconPlus size={14} />
                  Add
                </button>
              )}
            </div>
            <ul style={{ marginTop: 10, paddingLeft: 18, fontSize: 14 }}>
              {floors?.map((f) => <li key={f.id}>{floorLabel(f.id)}</li>)}
              {floors?.length === 0 && <li style={{ color: "#8a8577", listStyle: "none" }}>None yet.</li>}
            </ul>
          </div>
        </section>

        {canManage && showRoomTypeModal && (
          <Modal title="Add room type" onClose={() => setShowRoomTypeModal(false)}>
            <form
              onSubmit={handleAddRoomType}
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}
            >
              <input
                className="field-input"
                placeholder="Name (e.g. Deluxe King)"
                required
                value={roomTypeForm.name}
                onChange={(e) => setRoomTypeForm({ ...roomTypeForm, name: e.target.value })}
              />
              <input
                className="field-input"
                placeholder="Base rate / night"
                type="number"
                step="0.01"
                required
                value={roomTypeForm.base_rate_cents}
                onChange={(e) => setRoomTypeForm({ ...roomTypeForm, base_rate_cents: e.target.value })}
              />
              <input
                className="field-input"
                placeholder="Max occupancy"
                type="number"
                min={1}
                value={roomTypeForm.max_occupancy}
                onChange={(e) => setRoomTypeForm({ ...roomTypeForm, max_occupancy: e.target.value })}
              />
              <input
                className="field-input"
                placeholder="Amenities (comma separated)"
                value={roomTypeForm.amenities}
                onChange={(e) => setRoomTypeForm({ ...roomTypeForm, amenities: e.target.value })}
              />
              <input
                className="field-input"
                placeholder="Description"
                value={roomTypeForm.description}
                onChange={(e) => setRoomTypeForm({ ...roomTypeForm, description: e.target.value })}
                style={{ gridColumn: "1 / -1" }}
              />
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={roomTypeWorking || !roomTypeForm.name || !roomTypeForm.base_rate_cents}
                >
                  Add room type
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowRoomTypeModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        )}

        {canManage && showSeasonalRateModal && (
          <Modal title={editingSeasonalRateId ? "Edit seasonal rate" : "Add seasonal rate"} onClose={closeSeasonalRateModal}>
            <form
              onSubmit={handleAddSeasonalRate}
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}
            >
              <select
                className="field-select"
                required
                value={seasonalRateForm.room_type}
                onChange={(e) => setSeasonalRateForm({ ...seasonalRateForm, room_type: e.target.value })}
              >
                <option value="">Room type…</option>
                {roomTypes?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <input
                className="field-input"
                placeholder="Name (e.g. Christmas Peak)"
                required
                value={seasonalRateForm.name}
                onChange={(e) => setSeasonalRateForm({ ...seasonalRateForm, name: e.target.value })}
              />
              <input
                className="field-input"
                type="date"
                required
                value={seasonalRateForm.start_date}
                onChange={(e) => setSeasonalRateForm({ ...seasonalRateForm, start_date: e.target.value })}
              />
              <input
                className="field-input"
                type="date"
                required
                value={seasonalRateForm.end_date}
                onChange={(e) => setSeasonalRateForm({ ...seasonalRateForm, end_date: e.target.value })}
              />
              <input
                className="field-input"
                placeholder="Rate / night"
                type="number"
                step="0.01"
                required
                value={seasonalRateForm.rate_cents}
                onChange={(e) => setSeasonalRateForm({ ...seasonalRateForm, rate_cents: e.target.value })}
              />
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    seasonalRateWorking ||
                    !seasonalRateForm.room_type ||
                    !seasonalRateForm.name ||
                    !seasonalRateForm.start_date ||
                    !seasonalRateForm.end_date ||
                    !seasonalRateForm.rate_cents
                  }
                >
                  {editingSeasonalRateId ? "Save changes" : "Add seasonal rate"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeSeasonalRateModal}>
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        )}

        {canManage && showBuildingModal && (
          <Modal title="Add building" onClose={() => setShowBuildingModal(false)}>
            <form onSubmit={handleAddBuilding} style={{ display: "flex", gap: 8 }}>
              <input
                className="field-input"
                placeholder="Building name"
                required
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary" disabled={buildingWorking || !buildingName}>
                Add
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowBuildingModal(false)}>
                Cancel
              </button>
            </form>
          </Modal>
        )}

        {canManage && showFloorModal && (
          <Modal title="Add floor" onClose={() => setShowFloorModal(false)}>
            <form onSubmit={handleAddFloor} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select
                className="field-select"
                required
                value={floorForm.building}
                onChange={(e) => setFloorForm({ ...floorForm, building: e.target.value })}
              >
                <option value="">Building…</option>
                {buildings?.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <input
                className="field-input"
                placeholder="Floor name"
                required
                value={floorForm.name}
                onChange={(e) => setFloorForm({ ...floorForm, name: e.target.value })}
                style={{ flex: 1 }}
              />
              <input
                className="field-input"
                placeholder="Level"
                type="number"
                value={floorForm.level}
                onChange={(e) => setFloorForm({ ...floorForm, level: e.target.value })}
                style={{ width: 80 }}
              />
              <div style={{ width: "100%", display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={floorWorking || !floorForm.building || !floorForm.name}
                >
                  Add
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowFloorModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        )}
      </main>
    </ModuleShell>
  );
}
