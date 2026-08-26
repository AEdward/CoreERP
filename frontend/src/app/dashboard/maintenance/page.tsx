"use client";

import { Fragment, useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import { IconPlus } from "@/components/icons";
import {
  api,
  ApiError,
  type Asset,
  type AssetCategory,
  type AssetStatus,
  type Item,
  type MaintenanceSchedule,
  type Room,
  type Warehouse,
  type WorkOrder,
  type WorkOrderPriority,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";

const EMPTY_FORM = { room: "", asset: "", title: "", description: "", priority: "medium" as WorkOrderPriority };

const EMPTY_SCHEDULE_FORM = {
  room: "",
  title: "",
  description: "",
  priority: "medium" as WorkOrderPriority,
  frequency_days: "90",
  next_due_date: "",
};

const EMPTY_ASSET_FORM = {
  name: "",
  category: "other" as AssetCategory,
  room: "",
  location: "",
  serial_number: "",
  purchase_date: "",
  purchase_cost_cents: "",
  useful_life_years: "",
  warranty_expiry_date: "",
  status: "in_service" as AssetStatus,
  notes: "",
};

const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  furniture: "Furniture",
  electronics: "Electronics",
  hvac: "HVAC",
  kitchen_equipment: "Kitchen Equipment",
  vehicle: "Vehicle",
  other: "Other",
};

const ASSET_STATUS_BADGE: Record<AssetStatus, string> = {
  in_service: "badge-green",
  under_maintenance: "badge-gold",
  retired: "badge-gray",
};

const STATUS_BADGE: Record<WorkOrder["status"], string> = {
  open: "badge-red",
  in_progress: "badge-gold",
  completed: "badge-green",
  cancelled: "badge-gray",
};

const PRIORITY_BADGE: Record<WorkOrderPriority, string> = {
  low: "badge-gray",
  medium: "badge-gold",
  high: "badge-gold",
  urgent: "badge-red",
};

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function MaintenancePage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [workOrders, setWorkOrders] = useState<WorkOrder[] | null>(null);
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [working, setWorking] = useState(false);
  const [showWorkOrderModal, setShowWorkOrderModal] = useState(false);

  const [schedules, setSchedules] = useState<MaintenanceSchedule[] | null>(null);
  const [scheduleForm, setScheduleForm] = useState(EMPTY_SCHEDULE_FORM);
  const [scheduleWorking, setScheduleWorking] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [assetForm, setAssetForm] = useState(EMPTY_ASSET_FORM);
  const [assetWorking, setAssetWorking] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [showAssetModal, setShowAssetModal] = useState(false);

  const [items, setItems] = useState<Item[] | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null);
  const [expandedWorkOrderId, setExpandedWorkOrderId] = useState<number | null>(null);
  const [partForm, setPartForm] = useState({ item: "", warehouse: "", quantity: "1" });
  const [partWorking, setPartWorking] = useState(false);
  const [partError, setPartError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [w, r, s, a] = await Promise.all([
        api.listWorkOrders(),
        api.listRooms(),
        api.listMaintenanceSchedules(),
        api.listAssets(),
      ]);
      setWorkOrders(w);
      setRooms(r);
      setSchedules(s);
      setAssets(a);
      // Fetched separately, gated on inventory.view — Item/Warehouse are
      // inventory's own domain, a maintenance-only role shouldn't have
      // this 403 blank out the rest of the page via Promise.all (same
      // pattern as Loyalty in the Sales page).
      if (activeMembership?.permissions.includes("inventory.view")) {
        const [i, wh] = await Promise.all([api.listItems(), api.listWarehouses()]);
        setItems(i);
        setWarehouses(wh);
      } else {
        setItems([]);
        setWarehouses([]);
      }
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load work orders.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    try {
      await api.createWorkOrder({
        room: Number(form.room),
        asset: form.asset ? Number(form.asset) : null,
        title: form.title,
        description: form.description,
        priority: form.priority,
      });
      setForm(EMPTY_FORM);
      setShowWorkOrderModal(false);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to create work order.");
    } finally {
      setWorking(false);
    }
  }

  function startAddWorkOrder() {
    setForm(EMPTY_FORM);
    setLoadError(null);
    setShowWorkOrderModal(true);
  }

  function closeWorkOrderModal() {
    setShowWorkOrderModal(false);
    setForm(EMPTY_FORM);
  }

  async function handleResolve(id: number) {
    setActionError(null);
    try {
      await api.resolveWorkOrder(id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to resolve work order.");
    }
  }

  async function handleCreateSchedule(e: React.FormEvent) {
    e.preventDefault();
    setScheduleWorking(true);
    setScheduleError(null);
    try {
      await api.createMaintenanceSchedule({
        room: Number(scheduleForm.room),
        title: scheduleForm.title,
        description: scheduleForm.description,
        priority: scheduleForm.priority,
        frequency_days: Number(scheduleForm.frequency_days),
        next_due_date: scheduleForm.next_due_date,
      });
      setScheduleForm(EMPTY_SCHEDULE_FORM);
      setShowScheduleModal(false);
      await loadAll();
    } catch (err) {
      setScheduleError(err instanceof ApiError ? err.message : "Failed to create schedule.");
    } finally {
      setScheduleWorking(false);
    }
  }

  function startAddSchedule() {
    setScheduleForm(EMPTY_SCHEDULE_FORM);
    setScheduleError(null);
    setShowScheduleModal(true);
  }

  function closeScheduleModal() {
    setShowScheduleModal(false);
    setScheduleForm(EMPTY_SCHEDULE_FORM);
    setScheduleError(null);
  }

  async function handleGenerateWorkOrder(id: number) {
    setScheduleError(null);
    setGeneratingId(id);
    try {
      await api.generateWorkOrderFromSchedule(id);
      await loadAll();
    } catch (err) {
      setScheduleError(err instanceof ApiError ? err.message : "Failed to generate work order.");
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleToggleScheduleActive(schedule: MaintenanceSchedule) {
    setScheduleError(null);
    try {
      await api.updateMaintenanceSchedule(schedule.id, { is_active: !schedule.is_active });
      await loadAll();
    } catch (err) {
      setScheduleError(err instanceof ApiError ? err.message : "Failed to update schedule.");
    }
  }

  async function handleAddAsset(e: React.FormEvent) {
    e.preventDefault();
    setAssetWorking(true);
    setAssetError(null);
    try {
      const payload = {
        name: assetForm.name,
        category: assetForm.category,
        room: assetForm.room ? Number(assetForm.room) : null,
        location: assetForm.location,
        serial_number: assetForm.serial_number,
        purchase_date: assetForm.purchase_date || null,
        purchase_cost_cents: assetForm.purchase_cost_cents
          ? Math.round(Number(assetForm.purchase_cost_cents) * 100)
          : null,
        useful_life_years: assetForm.useful_life_years ? Number(assetForm.useful_life_years) : null,
        warranty_expiry_date: assetForm.warranty_expiry_date || null,
        status: assetForm.status,
        notes: assetForm.notes,
      };
      if (editingAssetId) {
        await api.updateAsset(editingAssetId, payload);
      } else {
        await api.createAsset(payload);
      }
      setAssetForm(EMPTY_ASSET_FORM);
      setEditingAssetId(null);
      setShowAssetModal(false);
      await loadAll();
    } catch (err) {
      setAssetError(err instanceof ApiError ? err.message : "Failed to save asset.");
    } finally {
      setAssetWorking(false);
    }
  }

  function startAddAsset() {
    setEditingAssetId(null);
    setAssetForm(EMPTY_ASSET_FORM);
    setAssetError(null);
    setShowAssetModal(true);
  }

  function startEditAsset(a: Asset) {
    setEditingAssetId(a.id);
    setAssetForm({
      name: a.name,
      category: a.category,
      room: a.room ? String(a.room) : "",
      location: a.location,
      serial_number: a.serial_number,
      purchase_date: a.purchase_date ?? "",
      purchase_cost_cents: a.purchase_cost_cents ? (a.purchase_cost_cents / 100).toString() : "",
      useful_life_years: a.useful_life_years ? String(a.useful_life_years) : "",
      warranty_expiry_date: a.warranty_expiry_date ?? "",
      status: a.status,
      notes: a.notes,
    });
    setAssetError(null);
    setShowAssetModal(true);
  }

  function closeAssetModal() {
    setShowAssetModal(false);
    setEditingAssetId(null);
    setAssetForm(EMPTY_ASSET_FORM);
    setAssetError(null);
  }

  async function handleDeleteAsset(id: number) {
    try {
      await api.deleteAsset(id);
      await loadAll();
    } catch (err) {
      setAssetError(err instanceof ApiError ? err.message : "Failed to delete asset.");
    }
  }

  async function handleUsePart(e: React.FormEvent, workOrderId: number) {
    e.preventDefault();
    setPartWorking(true);
    setPartError(null);
    try {
      await api.useWorkOrderPart(workOrderId, {
        item: Number(partForm.item),
        warehouse: Number(partForm.warehouse),
        quantity: Number(partForm.quantity),
      });
      setPartForm({ item: "", warehouse: "", quantity: "1" });
      await loadAll();
    } catch (err) {
      setPartError(err instanceof ApiError ? err.message : "Failed to record part usage.");
    } finally {
      setPartWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("maintenance.manage") ?? false;

  return (
    <ModuleShell moduleKey="maintenance" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1000, margin: "40px auto", padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <h1 className="page-title">Maintenance — {activeMembership?.company.name}</h1>
          {canManage && (
            <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
              <button type="button" className="btn btn-primary" onClick={startAddWorkOrder}>
                <IconPlus size={16} />
                Open work order
              </button>
              <button type="button" className="btn btn-secondary" onClick={startAddSchedule}>
                <IconPlus size={16} />
                Add schedule
              </button>
              <button type="button" className="btn btn-secondary" onClick={startAddAsset}>
                <IconPlus size={16} />
                Add asset
              </button>
            </div>
          )}
        </div>
        {loadError && <p className="error-text">{loadError}</p>}
        {actionError && <p className="error-text">{actionError}</p>}

        <section style={{ marginTop: 20 }}>
          <h2 className="section-label">Preventive maintenance schedules</h2>
          <p style={{ fontSize: 12, color: "#999", margin: "4px 0 8px" }}>
            Recurring reminders, not tickets — nothing runs on a timer, so a schedule only produces a work order
            when someone reviews it as &quot;due&quot; and clicks Generate.
          </p>
          {scheduleError && <p className="error-text">{scheduleError}</p>}
          <div className="panel">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Title</th>
                    <th>Every</th>
                    <th>Next due</th>
                    <th>Status</th>
                    {canManage && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {schedules?.map((s) => (
                    <tr key={s.id} style={{ opacity: s.is_active ? 1 : 0.5 }}>
                      <td>Room {s.room_number}</td>
                      <td>{s.title}</td>
                      <td>{s.frequency_days} days</td>
                      <td>{s.next_due_date}</td>
                      <td>
                        <span className={`badge ${!s.is_active ? "badge-gray" : s.is_due ? "badge-red" : "badge-green"}`}>
                          {!s.is_active ? "inactive" : s.is_due ? "due" : "scheduled"}
                        </span>
                      </td>
                      {canManage && (
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          {s.is_active && s.is_due && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleGenerateWorkOrder(s.id)}
                              disabled={generatingId === s.id}
                              style={{ marginRight: 4 }}
                            >
                              Generate work order
                            </button>
                          )}
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleToggleScheduleActive(s)}>
                            {s.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {schedules?.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={6}>No preventive maintenance schedules yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section style={{ marginTop: 32 }}>
          <h2 className="section-label">Assets</h2>
          <p style={{ fontSize: 12, color: "#999", margin: "4px 0 8px" }}>
            Equipment registry — tied to a room, or a free-text location for common-area equipment (lobby AC, an
            elevator). Work orders can optionally tag which asset they&apos;re about.
          </p>
          {assetError && <p className="error-text">{assetError}</p>}
          <div className="panel">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Location</th>
                    <th>Purchase cost</th>
                    <th>Warranty until</th>
                    <th>Status</th>
                    {canManage && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {assets?.map((a) => (
                    <tr key={a.id}>
                      <td>{a.name}</td>
                      <td>{ASSET_CATEGORY_LABELS[a.category]}</td>
                      <td>{a.room_number ? `Room ${a.room_number}` : a.location || "—"}</td>
                      <td>{a.purchase_cost_cents != null ? formatCents(a.purchase_cost_cents) : "—"}</td>
                      <td>{a.warranty_expiry_date || "—"}</td>
                      <td>
                        <span className={`badge ${ASSET_STATUS_BADGE[a.status]}`}>{a.status.replace("_", " ")}</span>
                      </td>
                      {canManage && (
                        <td style={{ textAlign: "right" }}>
                          <RowActions
                            onEdit={() => startEditAsset(a)}
                            onDelete={() => handleDeleteAsset(a.id)}
                            disabled={assetWorking}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                  {assets?.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={7}>No assets registered yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {canManage && showWorkOrderModal && (
          <Modal title="Open work order" onClose={closeWorkOrderModal}>
            <p style={{ fontSize: 12, color: "#999", margin: "0 0 8px" }}>
              Opening a work order takes the room out of service until it&apos;s resolved.
            </p>
            <form
              onSubmit={handleCreate}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10,
              }}
            >
              <select
                className="field-select"
                required
                value={form.room}
                onChange={(e) => setForm({ ...form, room: e.target.value })}
              >
                <option value="">Room…</option>
                {rooms?.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.number} ({r.status})
                  </option>
                ))}
              </select>
              <select
                className="field-select"
                value={form.asset}
                onChange={(e) => setForm({ ...form, asset: e.target.value })}
              >
                <option value="">Asset (optional)…</option>
                {assets
                  ?.filter((a) => !form.room || a.room === Number(form.room) || a.room === null)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.room === null && a.location ? ` (${a.location})` : ""}
                    </option>
                  ))}
              </select>
              <input
                className="field-input"
                placeholder="Title (e.g. AC not cooling)"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <select
                className="field-select"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as WorkOrderPriority })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <input
                className="field-input"
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                style={{ gridColumn: "1 / -1" }}
              />
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, marginTop: 4 }}>
                <button type="submit" className="btn btn-primary" disabled={working || !form.room || !form.title}>
                  Open work order
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeWorkOrderModal}>
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        )}

        {canManage && showScheduleModal && (
          <Modal title="Add schedule" onClose={closeScheduleModal}>
            <form
              onSubmit={handleCreateSchedule}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10,
              }}
            >
              <select
                className="field-select"
                required
                value={scheduleForm.room}
                onChange={(e) => setScheduleForm({ ...scheduleForm, room: e.target.value })}
              >
                <option value="">Room…</option>
                {rooms?.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.number}
                  </option>
                ))}
              </select>
              <input
                className="field-input"
                placeholder="Title (e.g. AC filter check)"
                required
                value={scheduleForm.title}
                onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
              />
              <select
                className="field-select"
                value={scheduleForm.priority}
                onChange={(e) => setScheduleForm({ ...scheduleForm, priority: e.target.value as WorkOrderPriority })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
              <input
                className="field-input"
                type="number"
                min={1}
                placeholder="Every N days"
                required
                value={scheduleForm.frequency_days}
                onChange={(e) => setScheduleForm({ ...scheduleForm, frequency_days: e.target.value })}
              />
              <input
                className="field-input"
                type="date"
                required
                value={scheduleForm.next_due_date}
                onChange={(e) => setScheduleForm({ ...scheduleForm, next_due_date: e.target.value })}
              />
              <input
                className="field-input"
                placeholder="Description"
                value={scheduleForm.description}
                onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })}
                style={{ gridColumn: "1 / -1" }}
              />
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={scheduleWorking || !scheduleForm.room || !scheduleForm.title || !scheduleForm.next_due_date}
                >
                  Add schedule
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeScheduleModal}>
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        )}

        {canManage && showAssetModal && (
          <Modal title={editingAssetId ? "Edit asset" : "Add asset"} onClose={closeAssetModal}>
            <form
              onSubmit={handleAddAsset}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10,
              }}
            >
              <input
                className="field-input"
                placeholder="Name (e.g. Lobby AC Unit)"
                required
                value={assetForm.name}
                onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
              />
              <select
                className="field-select"
                value={assetForm.category}
                onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value as AssetCategory })}
              >
                {Object.entries(ASSET_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                className="field-select"
                value={assetForm.room}
                onChange={(e) => setAssetForm({ ...assetForm, room: e.target.value })}
              >
                <option value="">No room (common area)</option>
                {rooms?.map((r) => (
                  <option key={r.id} value={r.id}>
                    Room {r.number}
                  </option>
                ))}
              </select>
              <input
                className="field-input"
                placeholder="Location (if no room, e.g. Main Lobby)"
                value={assetForm.location}
                onChange={(e) => setAssetForm({ ...assetForm, location: e.target.value })}
                disabled={!!assetForm.room}
              />
              <input
                className="field-input"
                placeholder="Serial number"
                value={assetForm.serial_number}
                onChange={(e) => setAssetForm({ ...assetForm, serial_number: e.target.value })}
              />
              <select
                className="field-select"
                value={assetForm.status}
                onChange={(e) => setAssetForm({ ...assetForm, status: e.target.value as AssetStatus })}
              >
                <option value="in_service">In service</option>
                <option value="under_maintenance">Under maintenance</option>
                <option value="retired">Retired</option>
              </select>
              <label className="field-label" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                Purchase date
                <input
                  className="field-input"
                  type="date"
                  value={assetForm.purchase_date}
                  onChange={(e) => setAssetForm({ ...assetForm, purchase_date: e.target.value })}
                />
              </label>
              <input
                className="field-input"
                placeholder="Purchase cost"
                type="number"
                step="0.01"
                value={assetForm.purchase_cost_cents}
                onChange={(e) => setAssetForm({ ...assetForm, purchase_cost_cents: e.target.value })}
              />
              <input
                className="field-input"
                placeholder="Useful life (years)"
                type="number"
                min={1}
                title="Used for straight-line depreciation on Finance's Asset Depreciation page"
                value={assetForm.useful_life_years}
                onChange={(e) => setAssetForm({ ...assetForm, useful_life_years: e.target.value })}
              />
              <label className="field-label" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                Warranty expiry
                <input
                  className="field-input"
                  type="date"
                  value={assetForm.warranty_expiry_date}
                  onChange={(e) => setAssetForm({ ...assetForm, warranty_expiry_date: e.target.value })}
                />
              </label>
              <input
                className="field-input"
                placeholder="Notes"
                value={assetForm.notes}
                onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })}
                style={{ gridColumn: "1 / -1" }}
              />
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, marginTop: 4 }}>
                <button type="submit" className="btn btn-primary" disabled={assetWorking || !assetForm.name}>
                  {editingAssetId ? "Save changes" : "Add asset"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeAssetModal}>
                  Cancel
                </button>
              </div>
              {assetError && <p className="error-text" style={{ gridColumn: "1 / -1", margin: 0 }}>{assetError}</p>}
            </form>
          </Modal>
        )}

        <section style={{ marginTop: 32, marginBottom: 40 }}>
          <h2 className="section-label">Work orders</h2>
          <div className="panel">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Title</th>
                    <th>Priority</th>
                    <th>Reported by</th>
                    <th>Status</th>
                    <th></th>
                    {canManage && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {workOrders?.map((w) => {
                    const isExpanded = expandedWorkOrderId === w.id;
                    return (
                      <Fragment key={w.id}>
                        <tr>
                          <td>Room {w.room_number}</td>
                          <td>
                            {w.title}
                            {w.asset_name && (
                              <div style={{ fontSize: 11, color: "#666" }}>Asset: {w.asset_name}</div>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${PRIORITY_BADGE[w.priority]}`}>{w.priority}</span>
                          </td>
                          <td>{w.reported_by_name || "—"}</td>
                          <td>
                            <span className={`badge ${STATUS_BADGE[w.status]}`}>{w.status.replace("_", " ")}</span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setExpandedWorkOrderId(isExpanded ? null : w.id);
                                setPartError(null);
                              }}
                            >
                              {isExpanded ? "Hide parts" : `Parts (${w.parts_used.length})`}
                            </button>
                          </td>
                          {canManage && (
                            <td style={{ textAlign: "right" }}>
                              {(w.status === "open" || w.status === "in_progress") && (
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleResolve(w.id)}>
                                  Resolve
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={7} style={{ padding: "8px 4px 16px 24px", background: "var(--brand-ivory)" }}>
                              {w.parts_used.length > 0 ? (
                                <ul style={{ margin: "0 0 8px", paddingLeft: 18, fontSize: 13 }}>
                                  {w.parts_used.map((p) => (
                                    <li key={p.id}>
                                      {p.quantity} x {p.item_name} (from {p.warehouse_name})
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p style={{ margin: "0 0 8px", fontSize: 13, color: "#999" }}>
                                  No parts used yet.
                                </p>
                              )}
                              {partError && <p className="error-text" style={{ fontSize: 13 }}>{partError}</p>}
                              {canManage &&
                                (items && items.length > 0 && warehouses && warehouses.length > 0 ? (
                                  <form
                                    onSubmit={(e) => handleUsePart(e, w.id)}
                                    style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
                                  >
                                    <select
                                      className="field-select"
                                      required
                                      value={partForm.item}
                                      onChange={(e) => setPartForm({ ...partForm, item: e.target.value })}
                                    >
                                      <option value="">Part…</option>
                                      {items.map((it) => (
                                        <option key={it.id} value={it.id}>
                                          {it.name}
                                        </option>
                                      ))}
                                    </select>
                                    <select
                                      className="field-select"
                                      required
                                      value={partForm.warehouse}
                                      onChange={(e) => setPartForm({ ...partForm, warehouse: e.target.value })}
                                    >
                                      <option value="">Warehouse…</option>
                                      {warehouses.map((wh) => (
                                        <option key={wh.id} value={wh.id}>
                                          {wh.name}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      className="field-input"
                                      type="number"
                                      min={1}
                                      required
                                      value={partForm.quantity}
                                      onChange={(e) => setPartForm({ ...partForm, quantity: e.target.value })}
                                      style={{ width: 80 }}
                                    />
                                    <button
                                      type="submit"
                                      className="btn btn-primary btn-sm"
                                      disabled={partWorking || !partForm.item || !partForm.warehouse}
                                    >
                                      Use part
                                    </button>
                                  </form>
                                ) : (
                                  <p style={{ fontSize: 12, color: "#999" }}>
                                    No inventory items/warehouses available to record part usage.
                                  </p>
                                ))}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {workOrders?.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={7}>No work orders yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </ModuleShell>
  );
}
