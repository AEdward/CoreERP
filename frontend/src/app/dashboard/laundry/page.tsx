"use client";

import { Fragment, useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import { ModuleShell } from "@/components/ModuleShell";
import { IconPlus } from "@/components/icons";
import { EMPTY_LINE, LineItemsEditor, type LineItemRow } from "@/components/LineItemsEditor";
import {
  api,
  ApiError,
  type Item,
  type LaundryCategory,
  type LaundryOrder,
  type Reservation,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";

const EMPTY_ADD_LINE = { item: "", quantity: "1", unit_price_cents: "" };

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const TRACKING_LABELS: Record<LaundryOrder["tracking_status"], string> = {
  received: "Received",
  washing: "Washing",
  ready: "Ready",
  delivered: "Delivered",
};

const TRACKING_BADGE: Record<LaundryOrder["tracking_status"], string> = {
  received: "badge-gray",
  washing: "badge-gold",
  ready: "badge-green",
  delivered: "badge-green",
};

const STATUS_BADGE: Record<LaundryOrder["status"], string> = {
  open: "badge-gold",
  paid: "badge-green",
  charged_to_room: "badge-green",
  cancelled: "badge-red",
};

export default function LaundryPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [orders, setOrders] = useState<LaundryOrder[] | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderCategory, setOrderCategory] = useState<LaundryCategory>("guest");
  const [orderReservation, setOrderReservation] = useState("");
  const [orderLines, setOrderLines] = useState<LineItemRow[]>([{ ...EMPTY_LINE }]);
  const [orderWorking, setOrderWorking] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [addLineForm, setAddLineForm] = useState(EMPTY_ADD_LINE);
  const [addLineWorking, setAddLineWorking] = useState(false);

  async function loadAll() {
    try {
      const [o, i, r] = await Promise.all([
        api.listLaundryOrders(),
        api.listItems(),
        api.listReservations(),
      ]);
      setOrders(o);
      setItems(i);
      setReservations(r);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load laundry data.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    setOrderWorking(true);
    setOrderError(null);
    try {
      await api.createLaundryOrder({
        category: orderCategory,
        reservation: orderCategory === "guest" && orderReservation ? Number(orderReservation) : null,
        lines: orderLines
          .filter((l) => l.item && l.quantity)
          .map((l) => ({
            item: Number(l.item),
            quantity: Number(l.quantity),
            unit_price_cents: Math.round(Number(l.unitPrice || 0) * 100),
          })),
      });
      setShowOrderModal(false);
      setOrderCategory("guest");
      setOrderReservation("");
      setOrderLines([{ ...EMPTY_LINE }]);
      await loadAll();
    } catch (err) {
      setOrderError(err instanceof ApiError ? err.message : "Failed to create order.");
    } finally {
      setOrderWorking(false);
    }
  }

  function startAddOrder() {
    setOrderCategory("guest");
    setOrderReservation("");
    setOrderLines([{ ...EMPTY_LINE }]);
    setOrderError(null);
    setShowOrderModal(true);
  }

  function closeOrderModal() {
    setShowOrderModal(false);
    setOrderError(null);
  }

  async function handleTracking(id: number, action: "startWashingLaundryOrder" | "markLaundryOrderReady" | "deliverLaundryOrder") {
    setActionError(null);
    try {
      await api[action](id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to update order.");
    }
  }

  async function handleChargeToRoom(id: number) {
    setActionError(null);
    try {
      await api.chargeLaundryOrderToRoom(id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to charge to room.");
    }
  }

  async function handleMarkPaid(id: number) {
    setActionError(null);
    try {
      await api.markLaundryOrderPaid(id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to mark paid.");
    }
  }

  async function handleCancel(id: number) {
    setActionError(null);
    try {
      await api.cancelLaundryOrder(id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to cancel order.");
    }
  }

  async function handleAddLine(e: React.FormEvent, orderId: number) {
    e.preventDefault();
    setAddLineWorking(true);
    setActionError(null);
    try {
      await api.addLaundryOrderLine({
        order: orderId,
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

  const canManage = activeMembership?.permissions.includes("laundry.manage") ?? false;
  const openReservations = reservations?.filter((r) => r.status === "checked_in") ?? [];

  return (
    <ModuleShell moduleKey="laundry" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px 40px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 className="page-title">Laundry</h1>
            <p className="page-subtitle">{activeMembership?.company.name}</p>
          </div>
          {canManage && (
            <button type="button" className="btn btn-primary" onClick={startAddOrder} style={{ flexShrink: 0 }}>
              <IconPlus size={16} />
              New order
            </button>
          )}
        </div>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}
        {actionError && <p className="error-text" style={{ marginTop: 8 }}>{actionError}</p>}

        {/* Orders */}
        <div className="panel" style={{ marginTop: 20 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Room charge</th>
                  <th>Total</th>
                  <th>Tracking</th>
                  <th>Billing</th>
                  <th>Receipt</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders?.map((o) => {
                  const isExpanded = expandedId === o.id;
                  return (
                    <Fragment key={o.id}>
                      <tr>
                        <td>{o.category === "guest" ? "Guest" : "Hotel linen"}</td>
                        <td>{o.reservation ? `Res #${o.reservation}` : "—"}</td>
                        <td>{formatCents(o.total_cents)}</td>
                        <td>
                          <span className={`badge ${TRACKING_BADGE[o.tracking_status]}`}>
                            {TRACKING_LABELS[o.tracking_status]}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${STATUS_BADGE[o.status]}`}>
                            {o.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td>{o.receipt_number || "—"}</td>
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                            {canManage && (
                              <>
                                {o.tracking_status === "received" && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleTracking(o.id, "startWashingLaundryOrder")}
                                  >
                                    Start washing
                                  </button>
                                )}
                                {o.tracking_status === "washing" && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleTracking(o.id, "markLaundryOrderReady")}
                                  >
                                    Mark ready
                                  </button>
                                )}
                                {o.tracking_status === "ready" && (
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleTracking(o.id, "deliverLaundryOrder")}
                                  >
                                    Deliver
                                  </button>
                                )}
                                {o.category === "guest" && o.status === "open" && (
                                  <>
                                    {o.reservation && (
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => handleChargeToRoom(o.id)}
                                      >
                                        Charge to room
                                      </button>
                                    )}
                                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleMarkPaid(o.id)}>
                                      Mark paid
                                    </button>
                                  </>
                                )}
                                {o.status === "open" && (
                                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleCancel(o.id)}>
                                    Cancel
                                  </button>
                                )}
                              </>
                            )}
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setExpandedId(isExpanded ? null : o.id)}
                            >
                              {isExpanded ? "Hide items" : "View items"}
                            </button>
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} style={{ padding: 12, background: "var(--brand-ivory)" }}>
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Item</th>
                                  <th>Qty</th>
                                  <th>Price</th>
                                </tr>
                              </thead>
                              <tbody>
                                {o.lines.map((l) => (
                                  <tr key={l.id}>
                                    <td>{l.item_name}</td>
                                    <td>{l.quantity}</td>
                                    <td>{formatCents(l.line_total_cents)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {canManage && o.status === "open" && (
                              <form
                                onSubmit={(e) => handleAddLine(e, o.id)}
                                style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}
                              >
                                <select
                                  className="field-select"
                                  value={addLineForm.item}
                                  onChange={(e) => setAddLineForm({ ...addLineForm, item: e.target.value })}
                                  style={{ maxWidth: 220 }}
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
                                  style={{ width: 80 }}
                                />
                                <input
                                  className="field-input"
                                  type="number"
                                  step="0.01"
                                  placeholder="Unit price"
                                  value={addLineForm.unit_price_cents}
                                  onChange={(e) =>
                                    setAddLineForm({ ...addLineForm, unit_price_cents: e.target.value })
                                  }
                                  style={{ width: 110 }}
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
                {orders?.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={7}>No laundry orders yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {canManage && showOrderModal && (
          <Modal title="New laundry order" onClose={closeOrderModal}>
            <form onSubmit={handleCreateOrder}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <select
                  className="field-select"
                  value={orderCategory}
                  onChange={(e) => setOrderCategory(e.target.value as LaundryCategory)}
                  style={{ flex: 1, minWidth: 160 }}
                >
                  <option value="guest">Guest laundry</option>
                  <option value="hotel_linen">Hotel linen</option>
                </select>
                {orderCategory === "guest" && (
                  <select
                    className="field-select"
                    value={orderReservation}
                    onChange={(e) => setOrderReservation(e.target.value)}
                    style={{ flex: 1, minWidth: 160 }}
                  >
                    <option value="">No room charge</option>
                    {openReservations.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.confirmation_number} — {r.guest_name} (Room {r.room_number})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <LineItemsEditor items={items ?? []} rows={orderLines} onChange={setOrderLines} priceLabel="Unit price" />
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="submit" className="btn btn-primary" disabled={orderWorking}>
                  Create order
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeOrderModal}>
                  Cancel
                </button>
              </div>
              {orderError && <p className="error-text" style={{ marginTop: 8 }}>{orderError}</p>}
            </form>
          </Modal>
        )}
      </main>
    </ModuleShell>
  );
}
