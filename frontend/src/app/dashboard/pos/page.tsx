"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { Modal } from "@/components/Modal";
import { ModuleShell } from "@/components/ModuleShell";
import { IconPlus } from "@/components/icons";
import { EMPTY_LINE, LineItemsEditor, type LineItemRow } from "@/components/LineItemsEditor";
import { RowActions } from "@/components/RowActions";
import {
  api,
  ApiError,
  type HappyHourRule,
  type Item,
  type PosOrder,
  type PosTable,
  type Promotion,
  type Reservation,
  type SuggestedPrice,
  type TableArea,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";

const EMPTY_ADD_LINE = { item: "", quantity: "1", unit_price_cents: "" };

const EMPTY_HAPPY_HOUR_FORM = {
  name: "",
  category: "",
  day_of_week: "",
  start_time: "17:00",
  end_time: "19:00",
  discount_percent: "20",
};

const EMPTY_PROMOTION_FORM = {
  name: "",
  discount_percent: "10",
  start_date: "",
  end_date: "",
};

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const AREA_TITLES: Record<string, string> = {
  restaurant: "Restaurant POS",
  bar: "Bar POS",
};

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const STATUS_BADGE: Record<PosOrder["status"], string> = {
  open: "badge-gold",
  paid: "badge-green",
  charged_to_room: "badge-green",
  cancelled: "badge-red",
};

export default function PosPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const searchParams = useSearchParams();
  const area = searchParams.get("area") as TableArea | null;
  const emptyTableForm = { name: "", area: area ?? ("restaurant" as TableArea), capacity: "4" };

  const [tables, setTables] = useState<PosTable[] | null>(null);
  const [orders, setOrders] = useState<PosOrder[] | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showTableModal, setShowTableModal] = useState(false);
  const [tableForm, setTableForm] = useState(emptyTableForm);
  const [tableWorking, setTableWorking] = useState(false);

  const [qrTable, setQrTable] = useState<PosTable | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderTable, setOrderTable] = useState("");
  const [orderReservation, setOrderReservation] = useState("");
  const [orderTabName, setOrderTabName] = useState("");
  const [orderLines, setOrderLines] = useState<LineItemRow[]>([{ ...EMPTY_LINE }]);
  const [orderWorking, setOrderWorking] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [addLineForm, setAddLineForm] = useState(EMPTY_ADD_LINE);
  const [suggestedPrice, setSuggestedPrice] = useState<SuggestedPrice | null>(null);

  const [promotionSelections, setPromotionSelections] = useState<Record<number, string>>({});
  const [promotionWorking, setPromotionWorking] = useState(false);

  const [happyHourRules, setHappyHourRules] = useState<HappyHourRule[] | null>(null);
  const [showHappyHourModal, setShowHappyHourModal] = useState(false);
  const [happyHourForm, setHappyHourForm] = useState(EMPTY_HAPPY_HOUR_FORM);
  const [happyHourWorking, setHappyHourWorking] = useState(false);
  const [happyHourError, setHappyHourError] = useState<string | null>(null);
  const [editingHappyHourId, setEditingHappyHourId] = useState<number | null>(null);

  const [promotions, setPromotions] = useState<Promotion[] | null>(null);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [promotionForm, setPromotionForm] = useState(EMPTY_PROMOTION_FORM);
  const [promotionFormWorking, setPromotionFormWorking] = useState(false);
  const [promotionFormError, setPromotionFormError] = useState<string | null>(null);
  const [editingPromotionId, setEditingPromotionId] = useState<number | null>(null);
  const [addLineWorking, setAddLineWorking] = useState(false);

  const [splitSelections, setSplitSelections] = useState<Record<number, number[]>>({});
  const [splitWorking, setSplitWorking] = useState(false);

  async function loadAll() {
    try {
      const [t, o, i, r, hh, promos] = await Promise.all([
        api.listTables(),
        api.listOrders(),
        api.listItems(),
        api.listReservations(),
        api.listHappyHourRules(),
        api.listPromotions(),
      ]);
      setTables(t);
      setOrders(o);
      setItems(i);
      setReservations(r);
      setHappyHourRules(hh);
      setPromotions(promos);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load POS data.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAddTable(e: React.FormEvent) {
    e.preventDefault();
    setTableWorking(true);
    try {
      await api.createTable({
        name: tableForm.name,
        area: tableForm.area,
        capacity: Number(tableForm.capacity || 2),
      });
      setShowTableModal(false);
      setTableForm(emptyTableForm);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to add table.");
    } finally {
      setTableWorking(false);
    }
  }

  function startAddTable() {
    setTableForm(emptyTableForm);
    setShowTableModal(true);
  }

  function closeTableModal() {
    setShowTableModal(false);
  }

  async function handleShowQr(t: PosTable) {
    setQrError(null);
    if (qrTable?.id === t.id) {
      setQrTable(null);
      setQrDataUrl(null);
      return;
    }
    setQrTable(t);
    try {
      const url = `${window.location.origin}/menu?company=${activeMembership?.company.id}&table=${t.id}`;
      const dataUrl = await QRCode.toDataURL(url, { width: 220, margin: 1 });
      setQrDataUrl(dataUrl);
    } catch {
      setQrError("Failed to generate the QR code.");
    }
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    setOrderWorking(true);
    setOrderError(null);
    try {
      await api.createOrder({
        table: orderTable ? Number(orderTable) : null,
        reservation: orderReservation ? Number(orderReservation) : null,
        tab_name: orderTabName,
        lines: orderLines
          .filter((l) => l.item && l.quantity)
          .map((l) => ({
            item: Number(l.item),
            quantity: Number(l.quantity),
            unit_price_cents: Math.round(Number(l.unitPrice || 0) * 100),
          })),
      });
      setShowOrderModal(false);
      setOrderTable("");
      setOrderReservation("");
      setOrderTabName("");
      setOrderLines([{ ...EMPTY_LINE }]);
      await loadAll();
    } catch (err) {
      setOrderError(err instanceof ApiError ? err.message : "Failed to create order.");
    } finally {
      setOrderWorking(false);
    }
  }

  function startAddOrder() {
    setOrderTable("");
    setOrderReservation("");
    setOrderTabName("");
    setOrderLines([{ ...EMPTY_LINE }]);
    setOrderError(null);
    setShowOrderModal(true);
  }

  function closeOrderModal() {
    setShowOrderModal(false);
    setOrderError(null);
  }

  async function handleChargeToRoom(id: number) {
    setActionError(null);
    try {
      await api.chargeOrderToRoom(id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to charge to room.");
    }
  }

  async function handleMarkPaid(id: number) {
    setActionError(null);
    try {
      await api.markOrderPaid(id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to mark paid.");
    }
  }

  async function handleCancel(id: number) {
    setActionError(null);
    try {
      await api.cancelOrder(id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to cancel order.");
    }
  }

  function toggleSplitLine(orderId: number, lineId: number) {
    setSplitSelections((prev) => {
      const current = prev[orderId] ?? [];
      const next = current.includes(lineId)
        ? current.filter((id) => id !== lineId)
        : [...current, lineId];
      return { ...prev, [orderId]: next };
    });
  }

  async function handleSplit(orderId: number) {
    const lineIds = splitSelections[orderId] ?? [];
    if (lineIds.length === 0) return;
    setSplitWorking(true);
    setActionError(null);
    try {
      const result = await api.splitOrder(orderId, lineIds);
      setSplitSelections((prev) => ({ ...prev, [orderId]: [] }));
      setExpandedId(result.new_order.id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to split the bill.");
    } finally {
      setSplitWorking(false);
    }
  }

  async function handleAddLine(e: React.FormEvent, orderId: number) {
    e.preventDefault();
    setAddLineWorking(true);
    setActionError(null);
    try {
      await api.addOrderLine({
        order: orderId,
        item: Number(addLineForm.item),
        quantity: Number(addLineForm.quantity || 1),
        unit_price_cents: Math.round(Number(addLineForm.unit_price_cents || 0) * 100),
      });
      setAddLineForm(EMPTY_ADD_LINE);
      setSuggestedPrice(null);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to add item.");
    } finally {
      setAddLineWorking(false);
    }
  }

  async function handleAddLineItemChange(itemId: string) {
    setAddLineForm({ ...addLineForm, item: itemId });
    setSuggestedPrice(null);
    if (!itemId) return;
    try {
      const result = await api.getSuggestedPrice(Number(itemId));
      setSuggestedPrice(result);
      setAddLineForm((prev) => ({ ...prev, item: itemId, unit_price_cents: (result.suggested_price_cents / 100).toString() }));
    } catch {
      // No suggestion available — staff can still type a price manually.
    }
  }

  async function handleApplyPromotion(orderId: number) {
    const promotionId = promotionSelections[orderId];
    if (!promotionId) return;
    setPromotionWorking(true);
    setActionError(null);
    try {
      await api.applyPromotion(orderId, Number(promotionId));
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to apply promotion.");
    } finally {
      setPromotionWorking(false);
    }
  }

  async function handleAddHappyHourRule(e: React.FormEvent) {
    e.preventDefault();
    setHappyHourWorking(true);
    setHappyHourError(null);
    try {
      const payload = {
        name: happyHourForm.name,
        category: happyHourForm.category,
        day_of_week: happyHourForm.day_of_week === "" ? null : Number(happyHourForm.day_of_week),
        start_time: happyHourForm.start_time,
        end_time: happyHourForm.end_time,
        discount_percent: happyHourForm.discount_percent,
      };
      if (editingHappyHourId) {
        await api.updateHappyHourRule(editingHappyHourId, payload);
      } else {
        await api.createHappyHourRule(payload);
      }
      setShowHappyHourModal(false);
      setHappyHourForm(EMPTY_HAPPY_HOUR_FORM);
      setEditingHappyHourId(null);
      await loadAll();
    } catch (err) {
      setHappyHourError(err instanceof ApiError ? err.message : "Failed to save happy hour rule.");
    } finally {
      setHappyHourWorking(false);
    }
  }

  function startAddHappyHour() {
    setEditingHappyHourId(null);
    setHappyHourForm(EMPTY_HAPPY_HOUR_FORM);
    setHappyHourError(null);
    setShowHappyHourModal(true);
  }

  function startEditHappyHour(rule: HappyHourRule) {
    setEditingHappyHourId(rule.id);
    setHappyHourForm({
      name: rule.name,
      category: rule.category,
      day_of_week: rule.day_of_week === null ? "" : String(rule.day_of_week),
      start_time: rule.start_time.slice(0, 5),
      end_time: rule.end_time.slice(0, 5),
      discount_percent: rule.discount_percent,
    });
    setHappyHourError(null);
    setShowHappyHourModal(true);
  }

  function closeHappyHourModal() {
    setShowHappyHourModal(false);
    setEditingHappyHourId(null);
    setHappyHourForm(EMPTY_HAPPY_HOUR_FORM);
    setHappyHourError(null);
  }

  async function handleDeleteHappyHourRule(id: number) {
    try {
      await api.deleteHappyHourRule(id);
      await loadAll();
    } catch (err) {
      setHappyHourError(err instanceof ApiError ? err.message : "Failed to delete happy hour rule.");
    }
  }

  async function handleAddPromotion(e: React.FormEvent) {
    e.preventDefault();
    setPromotionFormWorking(true);
    setPromotionFormError(null);
    try {
      const payload = {
        name: promotionForm.name,
        discount_percent: promotionForm.discount_percent,
        start_date: promotionForm.start_date,
        end_date: promotionForm.end_date,
      };
      if (editingPromotionId) {
        await api.updatePromotion(editingPromotionId, payload);
      } else {
        await api.createPromotion(payload);
      }
      setShowPromotionModal(false);
      setPromotionForm(EMPTY_PROMOTION_FORM);
      setEditingPromotionId(null);
      await loadAll();
    } catch (err) {
      setPromotionFormError(err instanceof ApiError ? err.message : "Failed to save promotion.");
    } finally {
      setPromotionFormWorking(false);
    }
  }

  function startAddPromotion() {
    setEditingPromotionId(null);
    setPromotionForm(EMPTY_PROMOTION_FORM);
    setPromotionFormError(null);
    setShowPromotionModal(true);
  }

  function startEditPromotion(promo: Promotion) {
    setEditingPromotionId(promo.id);
    setPromotionForm({
      name: promo.name,
      discount_percent: promo.discount_percent,
      start_date: promo.start_date,
      end_date: promo.end_date,
    });
    setPromotionFormError(null);
    setShowPromotionModal(true);
  }

  function closePromotionModal() {
    setShowPromotionModal(false);
    setEditingPromotionId(null);
    setPromotionForm(EMPTY_PROMOTION_FORM);
    setPromotionFormError(null);
  }

  async function handleDeletePromotion(id: number) {
    try {
      await api.deletePromotion(id);
      await loadAll();
    } catch (err) {
      setPromotionFormError(err instanceof ApiError ? err.message : "Failed to delete promotion.");
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("pos.manage") ?? false;
  const openReservations = reservations?.filter((r) => r.status === "checked_in") ?? [];
  const visibleTables = area ? tables?.filter((t) => t.area === area) ?? null : tables;
  const visibleOrders = area
    ? orders?.filter((o) => {
        if (o.table) return tables?.find((t) => t.id === o.table)?.area === area;
        // A tableless bar tab still belongs on the Bar POS view even
        // though it has no table to look an area up from.
        return area === "bar" && !!o.tab_name;
      }) ?? null
    : orders;
  const pageTitle = area ? AREA_TITLES[area] ?? "Restaurant & Bar" : "Restaurant & Bar";

  return (
    <ModuleShell moduleKey="pos" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px 40px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <h1 className="page-title">{pageTitle}</h1>
            <p className="page-subtitle">{activeMembership?.company.name}</p>
          </div>
          <Link href="/dashboard/kds" style={{ fontSize: 13, color: "var(--brand-green)", fontWeight: 600 }}>
            Kitchen Display →
          </Link>
        </div>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}
        {actionError && <p className="error-text" style={{ marginTop: 8 }}>{actionError}</p>}

        {/* Tables */}
        <section style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <h2 className="section-label">Tables</h2>
            {canManage && (
              <button type="button" className="btn btn-primary btn-sm" onClick={startAddTable}>
                <IconPlus size={14} />
                Add table
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {visibleTables?.map((t) => (
              <div
                key={t.id}
                className="panel"
                style={{
                  padding: "8px 14px",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span>
                  <strong>{t.name}</strong> — {t.area} (seats {t.capacity})
                </span>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleShowQr(t)}>
                  {qrTable?.id === t.id ? "Hide QR" : "QR Menu"}
                </button>
              </div>
            ))}
            {visibleTables?.length === 0 && <p style={{ color: "#8a8577", fontSize: 13 }}>No tables yet.</p>}
          </div>
          {qrError && <p className="error-text" style={{ marginTop: 8 }}>{qrError}</p>}
          {qrTable && qrDataUrl && (
            <div
              className="panel"
              style={{
                marginTop: 12,
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                Table {qrTable.name} — scan for the digital menu
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt={`QR code linking to the menu for table ${qrTable.name}`} width={220} height={220} />
              <a
                href={`${typeof window !== "undefined" ? window.location.origin : ""}/menu?company=${activeMembership?.company.id}&table=${qrTable.id}`}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: 12, wordBreak: "break-all", color: "var(--brand-green)" }}
              >
                {typeof window !== "undefined" ? window.location.origin : ""}/menu?company=
                {activeMembership?.company.id}&table={qrTable.id}
              </a>
            </div>
          )}
        </section>

        {canManage && showTableModal && (
          <Modal title="Add table" onClose={closeTableModal}>
            <form onSubmit={handleAddTable} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                className="field-input"
                placeholder="Table name"
                required
                value={tableForm.name}
                onChange={(e) => setTableForm({ ...tableForm, name: e.target.value })}
                style={{ flex: 1, minWidth: 140 }}
              />
              <select
                className="field-select"
                value={tableForm.area}
                onChange={(e) => setTableForm({ ...tableForm, area: e.target.value as TableArea })}
                style={{ maxWidth: 160 }}
              >
                <option value="restaurant">Restaurant</option>
                <option value="bar">Bar</option>
                <option value="outdoor">Outdoor</option>
              </select>
              <input
                className="field-input"
                type="number"
                min={1}
                placeholder="Capacity"
                value={tableForm.capacity}
                onChange={(e) => setTableForm({ ...tableForm, capacity: e.target.value })}
                style={{ width: 110 }}
              />
              <div style={{ width: "100%", display: "flex", gap: 8, marginTop: 4 }}>
                <button type="submit" className="btn btn-primary" disabled={tableWorking || !tableForm.name}>
                  Add table
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeTableModal}>
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Orders */}
        <section style={{ marginTop: 32, marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <h2 className="section-label">Orders</h2>
            {canManage && (
              <button type="button" className="btn btn-primary btn-sm" onClick={startAddOrder}>
                <IconPlus size={14} />
                New order
              </button>
            )}
          </div>
          <div className="panel" style={{ marginTop: 10 }}>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Table</th>
                    <th>Room charge</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Receipt</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOrders?.map((o) => {
                    const isExpanded = expandedId === o.id;
                    return (
                      <Fragment key={o.id}>
                        <tr>
                          <td>
                            {o.tab_name ? `Tab: ${o.tab_name}` : o.table_name || "Takeaway/room"}
                            {o.split_from && (
                              <div style={{ fontSize: 11, color: "#8a8577" }}>Split from order #{o.split_from}</div>
                            )}
                            {o.promotion_name && (
                              <div style={{ fontSize: 11, color: "var(--brand-green)" }}>
                                Promo: {o.promotion_name}
                              </div>
                            )}
                          </td>
                          <td>{o.reservation ? `Res #${o.reservation}` : "—"}</td>
                          <td>{formatCents(o.total_cents)}</td>
                          <td>
                            <span className={`badge ${STATUS_BADGE[o.status]}`}>{o.status.replace(/_/g, " ")}</span>
                          </td>
                          <td>{o.receipt_number || "—"}</td>
                          <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                            <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                              {canManage && o.status === "open" && (
                                <>
                                  {o.reservation && (
                                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleChargeToRoom(o.id)}>
                                      Charge to room
                                    </button>
                                  )}
                                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleMarkPaid(o.id)}>
                                    Mark paid
                                  </button>
                                  <button type="button" className="btn btn-danger btn-sm" onClick={() => handleCancel(o.id)}>
                                    Cancel
                                  </button>
                                </>
                              )}
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setExpandedId(isExpanded ? null : o.id)}>
                                {isExpanded ? "Hide items" : "View items"}
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
                                    {canManage && o.status === "open" && o.lines.length > 1 && <th></th>}
                                    <th>Item</th>
                                    <th>Qty</th>
                                    <th>Price</th>
                                    <th>Kitchen</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {o.lines.map((l) => (
                                    <tr key={l.id}>
                                      {canManage && o.status === "open" && o.lines.length > 1 && (
                                        <td>
                                          <input
                                            type="checkbox"
                                            style={{ width: 15, height: 15, accentColor: "var(--brand-green)", cursor: "pointer" }}
                                            checked={(splitSelections[o.id] ?? []).includes(l.id)}
                                            onChange={() => toggleSplitLine(o.id, l.id)}
                                          />
                                        </td>
                                      )}
                                      <td>{l.item_name}</td>
                                      <td>{l.quantity}</td>
                                      <td>{formatCents(l.line_total_cents)}</td>
                                      <td>{l.kitchen_status.replace(/_/g, " ")}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {canManage && o.status === "open" && o.lines.length > 1 && (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleSplit(o.id)}
                                  disabled={splitWorking || (splitSelections[o.id] ?? []).length === 0}
                                  style={{ marginTop: 10 }}
                                >
                                  Split selected into new bill
                                </button>
                              )}
                              {canManage && o.status === "open" && (promotions?.length ?? 0) > 0 && (
                                <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                                  <select
                                    className="field-select"
                                    value={promotionSelections[o.id] ?? ""}
                                    onChange={(e) =>
                                      setPromotionSelections({ ...promotionSelections, [o.id]: e.target.value })
                                    }
                                    style={{ maxWidth: 220 }}
                                  >
                                    <option value="">Promotion…</option>
                                    {promotions?.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name} ({p.discount_percent}%)
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleApplyPromotion(o.id)}
                                    disabled={promotionWorking || !promotionSelections[o.id]}
                                  >
                                    Apply promotion
                                  </button>
                                </div>
                              )}
                              {canManage && o.status === "open" && (
                                <form
                                  onSubmit={(e) => handleAddLine(e, o.id)}
                                  style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
                                >
                                  <select
                                    className="field-select"
                                    value={addLineForm.item}
                                    onChange={(e) => handleAddLineItemChange(e.target.value)}
                                    style={{ maxWidth: 200 }}
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
                                  {suggestedPrice && suggestedPrice.happy_hour_name && (
                                    <span style={{ fontSize: 12, color: "var(--brand-green)" }}>
                                      Happy Hour: {suggestedPrice.happy_hour_name} (-{suggestedPrice.discount_percent}%)
                                    </span>
                                  )}
                                </form>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {visibleOrders?.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={6}>No orders yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {canManage && showOrderModal && (
          <Modal title="New order" onClose={closeOrderModal}>
            <form onSubmit={handleCreateOrder}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <select className="field-select" value={orderTable} onChange={(e) => setOrderTable(e.target.value)} style={{ flex: 1, minWidth: 180 }}>
                  <option value="">No table (takeaway / room service)</option>
                  {visibleTables?.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.area})
                    </option>
                  ))}
                </select>
                <select
                  className="field-select"
                  value={orderReservation}
                  onChange={(e) => setOrderReservation(e.target.value)}
                  style={{ flex: 1, minWidth: 180 }}
                >
                  <option value="">No room charge</option>
                  {openReservations.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.confirmation_number} — {r.guest_name} (Room {r.room_number})
                    </option>
                  ))}
                </select>
              </div>
              {!orderTable && (
                <input
                  className="field-input"
                  placeholder="Bar tab name (e.g. Sarah — blue jacket)"
                  value={orderTabName}
                  onChange={(e) => setOrderTabName(e.target.value)}
                  style={{ marginBottom: 8, width: "100%" }}
                />
              )}
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

        {/* Happy Hour Rules */}
        <section style={{ marginTop: 40 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h2 className="section-label">Happy hour rules</h2>
              <p className="page-subtitle" style={{ marginTop: 4 }}>
                A discount window by item category. The suggested price shown when adding an item to an order picks
                up whichever rule is active right now.
              </p>
            </div>
            {canManage && (
              <button type="button" className="btn btn-primary btn-sm" onClick={startAddHappyHour} style={{ flexShrink: 0 }}>
                <IconPlus size={14} />
                Add rule
              </button>
            )}
          </div>
          {happyHourError && <p className="error-text" style={{ marginTop: 8 }}>{happyHourError}</p>}
          <div className="panel" style={{ marginTop: 10 }}>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Day</th>
                    <th>Window</th>
                    <th>Discount</th>
                    <th>Active</th>
                    {canManage && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {happyHourRules?.map((rule) => (
                    <tr key={rule.id}>
                      <td>{rule.name}</td>
                      <td>{rule.category || "All items"}</td>
                      <td>{rule.day_of_week === null ? "Every day" : DAY_NAMES[rule.day_of_week]}</td>
                      <td>{rule.start_time.slice(0, 5)}–{rule.end_time.slice(0, 5)}</td>
                      <td>{rule.discount_percent}%</td>
                      <td>
                        <span className={`badge ${rule.is_active ? "badge-green" : "badge-gray"}`}>
                          {rule.is_active ? "Yes" : "No"}
                        </span>
                      </td>
                      {canManage && (
                        <td style={{ textAlign: "right" }}>
                          <RowActions
                            onEdit={() => startEditHappyHour(rule)}
                            onDelete={() => handleDeleteHappyHourRule(rule.id)}
                            disabled={happyHourWorking}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                  {happyHourRules?.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={7}>No happy hour rules yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {canManage && showHappyHourModal && (
          <Modal title={editingHappyHourId ? "Edit happy hour rule" : "Add happy hour rule"} onClose={closeHappyHourModal}>
            <form
              onSubmit={handleAddHappyHourRule}
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}
            >
              <input
                className="field-input"
                placeholder="Name (e.g. Happy Hour)"
                required
                value={happyHourForm.name}
                onChange={(e) => setHappyHourForm({ ...happyHourForm, name: e.target.value })}
              />
              <input
                className="field-input"
                placeholder="Category (blank = all items)"
                value={happyHourForm.category}
                onChange={(e) => setHappyHourForm({ ...happyHourForm, category: e.target.value })}
              />
              <select
                className="field-select"
                value={happyHourForm.day_of_week}
                onChange={(e) => setHappyHourForm({ ...happyHourForm, day_of_week: e.target.value })}
              >
                <option value="">Every day</option>
                {DAY_NAMES.map((day, i) => (
                  <option key={day} value={i}>
                    {day}
                  </option>
                ))}
              </select>
              <input
                className="field-input"
                type="time"
                required
                value={happyHourForm.start_time}
                onChange={(e) => setHappyHourForm({ ...happyHourForm, start_time: e.target.value })}
              />
              <input
                className="field-input"
                type="time"
                required
                value={happyHourForm.end_time}
                onChange={(e) => setHappyHourForm({ ...happyHourForm, end_time: e.target.value })}
              />
              <input
                className="field-input"
                type="number"
                min={1}
                max={100}
                placeholder="Discount %"
                required
                value={happyHourForm.discount_percent}
                onChange={(e) => setHappyHourForm({ ...happyHourForm, discount_percent: e.target.value })}
              />
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={happyHourWorking || !happyHourForm.name}>
                  {editingHappyHourId ? "Save changes" : "Add rule"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={closeHappyHourModal}>
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Promotions */}
        <section style={{ marginTop: 40, marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h2 className="section-label">Promotions</h2>
              <p className="page-subtitle" style={{ marginTop: 4 }}>
                A manually-applied, order-level discount — pick one from an open order&apos;s expanded view.
              </p>
            </div>
            {canManage && (
              <button type="button" className="btn btn-primary btn-sm" onClick={startAddPromotion} style={{ flexShrink: 0 }}>
                <IconPlus size={14} />
                Add promotion
              </button>
            )}
          </div>
          {promotionFormError && <p className="error-text" style={{ marginTop: 8 }}>{promotionFormError}</p>}
          <div className="panel" style={{ marginTop: 10 }}>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Discount</th>
                    <th>Dates</th>
                    <th>Active</th>
                    {canManage && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {promotions?.map((promo) => (
                    <tr key={promo.id}>
                      <td>{promo.name}</td>
                      <td>{promo.discount_percent}%</td>
                      <td>{promo.start_date} → {promo.end_date}</td>
                      <td>
                        <span className={`badge ${promo.is_active ? "badge-green" : "badge-gray"}`}>
                          {promo.is_active ? "Yes" : "No"}
                        </span>
                      </td>
                      {canManage && (
                        <td style={{ textAlign: "right" }}>
                          <RowActions
                            onEdit={() => startEditPromotion(promo)}
                            onDelete={() => handleDeletePromotion(promo.id)}
                            disabled={promotionFormWorking}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                  {promotions?.length === 0 && (
                    <tr className="empty-row">
                      <td colSpan={5}>No promotions yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {canManage && showPromotionModal && (
          <Modal title={editingPromotionId ? "Edit promotion" : "Add promotion"} onClose={closePromotionModal}>
            <form
              onSubmit={handleAddPromotion}
              style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}
            >
              <input
                className="field-input"
                placeholder="Name (e.g. Weekend Special)"
                required
                value={promotionForm.name}
                onChange={(e) => setPromotionForm({ ...promotionForm, name: e.target.value })}
              />
              <input
                className="field-input"
                type="number"
                min={1}
                max={100}
                placeholder="Discount %"
                required
                value={promotionForm.discount_percent}
                onChange={(e) => setPromotionForm({ ...promotionForm, discount_percent: e.target.value })}
              />
              <input
                className="field-input"
                type="date"
                required
                value={promotionForm.start_date}
                onChange={(e) => setPromotionForm({ ...promotionForm, start_date: e.target.value })}
              />
              <input
                className="field-input"
                type="date"
                required
                value={promotionForm.end_date}
                onChange={(e) => setPromotionForm({ ...promotionForm, end_date: e.target.value })}
              />
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                <button type="submit" className="btn btn-primary" disabled={promotionFormWorking || !promotionForm.name}>
                  {editingPromotionId ? "Save changes" : "Add promotion"}
                </button>
                <button type="button" className="btn btn-secondary" onClick={closePromotionModal}>
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
