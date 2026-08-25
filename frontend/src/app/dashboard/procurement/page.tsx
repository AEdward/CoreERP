"use client";

import { Fragment, useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { EMPTY_LINE, LineItemsEditor, type LineItemRow } from "@/components/LineItemsEditor";
import { ActivityPanel } from "@/components/ActivityPanel";
import { ApprovalPanel } from "@/components/ApprovalPanel";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { NotesPanel } from "@/components/NotesPanel";
import { RowActions } from "@/components/RowActions";
import {
  api,
  ApiError,
  type Bill,
  type CompanyMember,
  type Item,
  type PurchaseOrder,
  type PurchaseRequest,
  type PurchaseReturn,
  type Supplier,
  type Warehouse,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

function poLinesToRows(lines: PurchaseOrder["lines"]): LineItemRow[] {
  return lines.map((l) => ({
    item: String(l.item),
    quantity: String(l.quantity),
    unitPrice: (l.unit_cost_cents / 100).toString(),
  }));
}

const EMPTY_SUPPLIER_FORM = { name: "", phone: "", email: "", address: "", tax_number: "" };

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const STATUS_BADGE: Record<string, string> = {
  draft: "badgeInfo",
  submitted: "badgeWarn",
  pending: "badgeWarn",
  approved: "badgeSuccess",
  received: "badgeSuccess",
  paid: "badgeSuccess",
  rejected: "badgeDanger",
  cancelled: "badgeDanger",
  overdue: "badgeDanger",
  unpaid: "badgeDanger",
};

function statusBadgeClass(status: string) {
  const key = STATUS_BADGE[status] ?? "badgeInfo";
  return `${shared.badge} ${shared[key]}`;
}

export default function ProcurementPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null);
  const [members, setMembers] = useState<CompanyMember[] | null>(null);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[] | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[] | null>(null);
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [purchaseReturns, setPurchaseReturns] = useState<PurchaseReturn[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER_FORM);
  const [supplierWorking, setSupplierWorking] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);

  const [prRequestedBy, setPrRequestedBy] = useState("");
  const [prJustification, setPrJustification] = useState("");
  const [prLines, setPrLines] = useState<LineItemRow[]>([{ ...EMPTY_LINE }]);
  const [prWorking, setPrWorking] = useState(false);
  const [prError, setPrError] = useState<string | null>(null);
  const [convertingPrId, setConvertingPrId] = useState<number | null>(null);
  const [convertSupplier, setConvertSupplier] = useState("");

  const [poSupplier, setPoSupplier] = useState("");
  const [poStatus, setPoStatus] = useState<PurchaseOrder["status"]>("draft");
  const [poLines, setPoLines] = useState<LineItemRow[]>([{ ...EMPTY_LINE }]);
  const [poWorking, setPoWorking] = useState(false);
  const [poError, setPoError] = useState<string | null>(null);
  const [editingPoId, setEditingPoId] = useState<number | null>(null);

  const [receivingOrderId, setReceivingOrderId] = useState<number | null>(null);
  const [receiveWarehouse, setReceiveWarehouse] = useState("");
  const [receiveQuantities, setReceiveQuantities] = useState<Record<number, string>>({});
  const [receiveWorking, setReceiveWorking] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);

  const [billPo, setBillPo] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billTax, setBillTax] = useState("0");
  const [billDueDate, setBillDueDate] = useState("");
  const [billWorking, setBillWorking] = useState(false);
  const [billError, setBillError] = useState<string | null>(null);

  const [prtBill, setPrtBill] = useState("");
  const [prtAmount, setPrtAmount] = useState("");
  const [prtTax, setPrtTax] = useState("0");
  const [prtReason, setPrtReason] = useState("");
  const [prtWorking, setPrtWorking] = useState(false);
  const [prtError, setPrtError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [s, i, w, m, pr, o, b, prt] = await Promise.all([
        api.listSuppliers(),
        api.listItems(),
        api.listWarehouses(),
        api.listCompanyMembers(),
        api.listPurchaseRequests(),
        api.listPurchaseOrders(),
        api.listBills(),
        api.listPurchaseReturns(),
      ]);
      setSuppliers(s);
      setItems(i);
      setWarehouses(w);
      setMembers(m);
      setPurchaseRequests(pr);
      setOrders(o);
      setBills(b);
      setPurchaseReturns(prt);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load procurement data.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAddSupplier(e: React.FormEvent) {
    e.preventDefault();
    setSupplierWorking(true);
    try {
      if (editingSupplierId) {
        await api.updateSupplier(editingSupplierId, supplierForm);
      } else {
        await api.createSupplier(supplierForm);
      }
      setSupplierForm(EMPTY_SUPPLIER_FORM);
      setEditingSupplierId(null);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save supplier.");
    } finally {
      setSupplierWorking(false);
    }
  }

  function startEditSupplier(s: Supplier) {
    setEditingSupplierId(s.id);
    setSupplierForm({
      name: s.name,
      phone: s.phone,
      email: s.email,
      address: s.address,
      tax_number: s.tax_number,
    });
  }

  async function handleDeleteSupplier(id: number) {
    try {
      await api.deleteSupplier(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to delete supplier.");
    }
  }

  async function handleAddPurchaseRequest(e: React.FormEvent) {
    e.preventDefault();
    setPrWorking(true);
    setPrError(null);
    try {
      const lines = prLines
        .filter((l) => l.item && l.quantity)
        .map((l) => ({
          item: Number(l.item),
          quantity: Number(l.quantity),
          estimated_unit_cost_cents: Math.round(Number(l.unitPrice || 0) * 100),
        }));
      await api.createPurchaseRequest({
        requested_by: prRequestedBy ? Number(prRequestedBy) : null,
        justification: prJustification,
        lines,
      });
      setPrRequestedBy("");
      setPrJustification("");
      setPrLines([{ ...EMPTY_LINE }]);
      await loadAll();
    } catch (err) {
      setPrError(err instanceof ApiError ? err.message : "Failed to save purchase request.");
    } finally {
      setPrWorking(false);
    }
  }

  async function handleDeletePurchaseRequest(id: number) {
    try {
      await api.deletePurchaseRequest(id);
      await loadAll();
    } catch (err) {
      setPrError(err instanceof ApiError ? err.message : "Failed to delete purchase request.");
    }
  }

  async function handleConvertPurchaseRequest(id: number) {
    if (!convertSupplier) return;
    setPrWorking(true);
    setPrError(null);
    try {
      await api.convertPurchaseRequest(id, Number(convertSupplier));
      setConvertingPrId(null);
      setConvertSupplier("");
      await loadAll();
    } catch (err) {
      setPrError(err instanceof ApiError ? err.message : "Failed to convert purchase request.");
    } finally {
      setPrWorking(false);
    }
  }

  async function handleReceive(order: PurchaseOrder) {
    if (!receiveWarehouse) return;
    setReceiveWorking(true);
    setReceiveError(null);
    try {
      const lines = order.lines
        .filter((l) => Number(receiveQuantities[l.id] || 0) > 0)
        .map((l) => ({ line: l.id, quantity: Number(receiveQuantities[l.id]) }));
      if (lines.length === 0) {
        setReceiveError("Enter a quantity for at least one line.");
        setReceiveWorking(false);
        return;
      }
      await api.receivePurchaseOrder(order.id, { warehouse: Number(receiveWarehouse), lines });
      setReceivingOrderId(null);
      setReceiveWarehouse("");
      setReceiveQuantities({});
      await loadAll();
    } catch (err) {
      setReceiveError(err instanceof ApiError ? err.message : "Failed to receive stock.");
    } finally {
      setReceiveWorking(false);
    }
  }

  async function handleAddPurchaseOrder(e: React.FormEvent) {
    e.preventDefault();
    setPoWorking(true);
    setPoError(null);
    try {
      const lines = poLines
        .filter((l) => l.item && l.quantity)
        .map((l) => ({
          item: Number(l.item),
          quantity: Number(l.quantity),
          unit_cost_cents: Math.round(Number(l.unitPrice || 0) * 100),
        }));
      const payload = { supplier: Number(poSupplier), status: poStatus, lines };
      if (editingPoId) {
        await api.updatePurchaseOrder(editingPoId, payload);
      } else {
        await api.createPurchaseOrder(payload);
      }
      setPoSupplier("");
      setPoStatus("draft");
      setPoLines([{ ...EMPTY_LINE }]);
      setEditingPoId(null);
      await loadAll();
    } catch (err) {
      setPoError(err instanceof ApiError ? err.message : "Failed to save purchase order.");
    } finally {
      setPoWorking(false);
    }
  }

  function startEditPurchaseOrder(o: PurchaseOrder) {
    setEditingPoId(o.id);
    setPoSupplier(String(o.supplier));
    setPoStatus(o.status);
    setPoLines(poLinesToRows(o.lines));
  }

  async function handleDeletePurchaseOrder(id: number) {
    try {
      await api.deletePurchaseOrder(id);
      await loadAll();
    } catch (err) {
      setPoError(err instanceof ApiError ? err.message : "Failed to delete purchase order.");
    }
  }

  async function handleAddBill(e: React.FormEvent) {
    e.preventDefault();
    setBillWorking(true);
    setBillError(null);
    try {
      await api.createBill({
        purchase_order: billPo ? Number(billPo) : null,
        amount_cents: billPo ? undefined : Math.round(Number(billAmount || 0) * 100),
        tax_amount_cents: Math.round(Number(billTax || 0) * 100),
        due_date: billDueDate || null,
      });
      setBillPo("");
      setBillAmount("");
      setBillTax("0");
      setBillDueDate("");
      await loadAll();
    } catch (err) {
      setBillError(err instanceof ApiError ? err.message : "Failed to create bill.");
    } finally {
      setBillWorking(false);
    }
  }

  async function handleAddPurchaseReturn(e: React.FormEvent) {
    e.preventDefault();
    setPrtWorking(true);
    setPrtError(null);
    try {
      await api.createPurchaseReturn({
        bill: Number(prtBill),
        amount_cents: Math.round(Number(prtAmount || 0) * 100),
        tax_amount_cents: Math.round(Number(prtTax || 0) * 100),
        reason: prtReason,
      });
      setPrtBill("");
      setPrtAmount("");
      setPrtTax("0");
      setPrtReason("");
      await loadAll();
    } catch (err) {
      setPrtError(err instanceof ApiError ? err.message : "Failed to create purchase return.");
    } finally {
      setPrtWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("procurement.manage") ?? false;
  const supplierName = (id: number) => suppliers?.find((s) => s.id === id)?.name ?? "—";

  return (
    <ModuleShell moduleKey="procurement" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Procurement</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        {/* Suppliers */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Suppliers</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Tax number</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {suppliers?.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.phone || "—"}</td>
                    <td>{s.email || "—"}</td>
                    <td>{s.tax_number || "—"}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions
                          onEdit={() => startEditSupplier(s)}
                          onDelete={() => handleDeleteSupplier(s.id)}
                          disabled={supplierWorking}
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {suppliers?.length === 0 && (
                  <tr>
                    <td colSpan={5} className={shared.tableMuted}>
                      No suppliers yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form onSubmit={handleAddSupplier} className={shared.formGrid} style={{ marginTop: 16 }}>
                <input
                  placeholder="Name"
                  required
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Phone"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Email"
                  type="email"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Address"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Tax number"
                  value={supplierForm.tax_number}
                  onChange={(e) => setSupplierForm({ ...supplierForm, tax_number: e.target.value })}
                  className={shared.input}
                />
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                  <button
                    type="submit"
                    disabled={supplierWorking || !supplierForm.name}
                    className={`${shared.btn} ${shared.btnPrimary}`}
                  >
                    {editingSupplierId ? "Save changes" : "Add supplier"}
                  </button>
                  {editingSupplierId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSupplierId(null);
                        setSupplierForm(EMPTY_SUPPLIER_FORM);
                      }}
                      className={shared.btn}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Purchase Requests */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Purchase requests</h2>
          <div className={shared.card}>
            <p className={shared.hint} style={{ maxWidth: 600, marginBottom: 12 }}>
              The internal &quot;we need to buy this&quot; step before a supplier is chosen. Request
              approval from the panel on each row; once approved, convert it into a real draft
              purchase order against a supplier.
            </p>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Requested by</th>
                  <th>Justification</th>
                  <th>Lines</th>
                  <th>Est. total</th>
                  <th>Status</th>
                  <th></th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {purchaseRequests?.map((pr) => (
                  <tr key={pr.id}>
                    <td>{pr.requested_by_name || "—"}</td>
                    <td>{pr.justification}</td>
                    <td>{pr.lines.length}</td>
                    <td>{formatCents(pr.total_cents)}</td>
                    <td>
                      <span className={statusBadgeClass(pr.status)}>{pr.status}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        <ApprovalPanel
                          target={{ appLabel: "procurement", model: "purchaserequest", objectId: pr.id }}
                          canManage={canManage}
                        />
                        {canManage && pr.status === "approved" && convertingPrId !== pr.id && (
                          <button
                            type="button"
                            onClick={() => setConvertingPrId(pr.id)}
                            className={`${shared.btn} ${shared.btnSmall}`}
                          >
                            Convert to PO
                          </button>
                        )}
                        {canManage && convertingPrId === pr.id && (
                          <>
                            <select
                              value={convertSupplier}
                              onChange={(e) => setConvertSupplier(e.target.value)}
                              className={shared.select}
                            >
                              <option value="">Supplier…</option>
                              {suppliers?.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={prWorking || !convertSupplier}
                              onClick={() => handleConvertPurchaseRequest(pr.id)}
                              className={`${shared.btn} ${shared.btnPrimary} ${shared.btnSmall}`}
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setConvertingPrId(null);
                                setConvertSupplier("");
                              }}
                              className={`${shared.btn} ${shared.btnSmall}`}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDeletePurchaseRequest(pr.id)} disabled={prWorking} />
                      </td>
                    )}
                  </tr>
                ))}
                {purchaseRequests?.length === 0 && (
                  <tr>
                    <td colSpan={7} className={shared.tableMuted}>
                      No purchase requests yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form onSubmit={handleAddPurchaseRequest} style={{ marginTop: 16, maxWidth: 640 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <select
                    value={prRequestedBy}
                    onChange={(e) => setPrRequestedBy(e.target.value)}
                    className={shared.select}
                    style={{ flex: 1 }}
                  >
                    <option value="">Requested by…</option>
                    {members?.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Justification"
                    value={prJustification}
                    onChange={(e) => setPrJustification(e.target.value)}
                    className={shared.input}
                    style={{ flex: 2 }}
                  />
                </div>
                <LineItemsEditor
                  items={items ?? []}
                  rows={prLines}
                  onChange={setPrLines}
                  priceLabel="Est. unit cost"
                />
                <button
                  type="submit"
                  disabled={prWorking}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                  style={{ marginTop: 8 }}
                >
                  Add purchase request
                </button>
                {prError && <p className={shared.errorText}>{prError}</p>}
              </form>
            )}
          </div>
        </div>

        {/* Purchase Orders */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Purchase orders</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th>Lines</th>
                  <th>Total</th>
                  <th></th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {orders?.map((o) => (
                  <Fragment key={o.id}>
                    <tr>
                      <td>{supplierName(o.supplier)}</td>
                      <td>
                        <span className={statusBadgeClass(o.status)}>{o.status}</span>
                      </td>
                      <td>{o.lines.length}</td>
                      <td>{formatCents(o.total_cents)}</td>
                      <td style={{ textAlign: "right" }}>
                        <span style={{ display: "inline-flex", gap: 6 }}>
                          <DocumentsPanel
                            target={{ appLabel: "procurement", model: "purchaseorder", objectId: o.id }}
                            canManage={canManage}
                          />
                          <NotesPanel
                            target={{ appLabel: "procurement", model: "purchaseorder", objectId: o.id }}
                            canManage={canManage}
                          />
                          <ActivityPanel
                            target={{ appLabel: "procurement", model: "purchaseorder", objectId: o.id }}
                          />
                          <ApprovalPanel
                            target={{ appLabel: "procurement", model: "purchaseorder", objectId: o.id }}
                            canManage={canManage}
                          />
                          {canManage && o.status === "approved" && receivingOrderId !== o.id && (
                            <button
                              type="button"
                              onClick={() => {
                                setReceivingOrderId(o.id);
                                setReceiveError(null);
                              }}
                              className={`${shared.btn} ${shared.btnSmall}`}
                            >
                              Receive
                            </button>
                          )}
                        </span>
                      </td>
                      {canManage && (
                        <td style={{ textAlign: "right" }}>
                          <RowActions
                            onEdit={() => startEditPurchaseOrder(o)}
                            onDelete={() => handleDeletePurchaseOrder(o.id)}
                            disabled={poWorking}
                          />
                        </td>
                      )}
                    </tr>
                    {receivingOrderId === o.id && (
                      <tr style={{ background: "var(--gray-50)" }}>
                        <td colSpan={6} style={{ padding: "10px 8px" }}>
                          <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                            <select
                              value={receiveWarehouse}
                              onChange={(e) => setReceiveWarehouse(e.target.value)}
                              className={shared.select}
                            >
                              <option value="">Warehouse…</option>
                              {warehouses?.map((w) => (
                                <option key={w.id} value={w.id}>
                                  {w.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          {o.lines.map((line) => (
                            <div
                              key={line.id}
                              style={{ display: "flex", gap: 8, marginBottom: 4, alignItems: "center" }}
                            >
                              <span style={{ fontSize: 13, width: 220 }}>
                                {items?.find((it) => it.id === line.item)?.name ?? `Item #${line.item}`}
                                {" — outstanding "}
                                {line.outstanding_quantity}
                              </span>
                              <input
                                type="number"
                                min="0"
                                max={line.outstanding_quantity}
                                placeholder="Qty to receive"
                                value={receiveQuantities[line.id] ?? ""}
                                onChange={(e) =>
                                  setReceiveQuantities({ ...receiveQuantities, [line.id]: e.target.value })
                                }
                                disabled={line.outstanding_quantity === 0}
                                className={shared.input}
                                style={{ width: 140 }}
                              />
                            </div>
                          ))}
                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <button
                              type="button"
                              disabled={receiveWorking || !receiveWarehouse}
                              onClick={() => handleReceive(o)}
                              className={`${shared.btn} ${shared.btnPrimary}`}
                            >
                              Confirm receipt
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReceivingOrderId(null);
                                setReceiveWarehouse("");
                                setReceiveQuantities({});
                                setReceiveError(null);
                              }}
                              className={shared.btn}
                            >
                              Cancel
                            </button>
                          </div>
                          {receiveError && <p className={shared.errorText}>{receiveError}</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {orders?.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      No purchase orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form onSubmit={handleAddPurchaseOrder} style={{ marginTop: 16, maxWidth: 640 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <select
                    required
                    value={poSupplier}
                    onChange={(e) => setPoSupplier(e.target.value)}
                    className={shared.select}
                    style={{ flex: 1 }}
                  >
                    <option value="">Supplier…</option>
                    {suppliers?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {["submitted", "approved", "rejected"].includes(poStatus) ? (
                    <span className={shared.hint} style={{ padding: 8 }}>
                      Status: {poStatus} (set by the approval flow, not editable here)
                    </span>
                  ) : (
                    <select
                      value={poStatus}
                      onChange={(e) => setPoStatus(e.target.value as PurchaseOrder["status"])}
                      className={shared.select}
                    >
                      <option value="draft">Draft</option>
                      <option value="received">Received</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  )}
                </div>
                <LineItemsEditor
                  items={items ?? []}
                  rows={poLines}
                  onChange={setPoLines}
                  priceLabel="Unit cost"
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    type="submit"
                    disabled={poWorking || !poSupplier}
                    className={`${shared.btn} ${shared.btnPrimary}`}
                  >
                    {editingPoId ? "Save changes" : "Create purchase order"}
                  </button>
                  {editingPoId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPoId(null);
                        setPoSupplier("");
                        setPoStatus("draft");
                        setPoLines([{ ...EMPTY_LINE }]);
                      }}
                      className={shared.btn}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {poError && <p className={shared.errorText}>{poError}</p>}
              </form>
            )}
          </div>
        </div>

        {/* Bills (AP) */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Bills</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Amount</th>
                  <th>Tax</th>
                  <th>Due date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bills?.map((bill) => (
                  <tr key={bill.id}>
                    <td>{bill.bill_number}</td>
                    <td>{formatCents(bill.amount_cents)}</td>
                    <td>{formatCents(bill.tax_amount_cents)}</td>
                    <td>{bill.due_date || "—"}</td>
                    <td>
                      <span className={statusBadgeClass(bill.status)}>{bill.status}</span>
                    </td>
                  </tr>
                ))}
                {bills?.length === 0 && (
                  <tr>
                    <td colSpan={5} className={shared.tableMuted}>
                      No bills yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form onSubmit={handleAddBill} className={shared.formGrid} style={{ marginTop: 16 }}>
                <select value={billPo} onChange={(e) => setBillPo(e.target.value)} className={shared.select}>
                  <option value="">No linked purchase order (manual amount)</option>
                  {orders?.map((o) => (
                    <option key={o.id} value={o.id}>
                      PO-{o.id} ({supplierName(o.supplier)}) — {formatCents(o.total_cents)}
                    </option>
                  ))}
                </select>
                {!billPo && (
                  <input
                    placeholder="Amount"
                    type="number"
                    step="0.01"
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    className={shared.input}
                  />
                )}
                {!billPo && (
                  <input
                    placeholder="Tax amount"
                    type="number"
                    step="0.01"
                    value={billTax}
                    onChange={(e) => setBillTax(e.target.value)}
                    className={shared.input}
                  />
                )}
                <input
                  type="date"
                  value={billDueDate}
                  onChange={(e) => setBillDueDate(e.target.value)}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={billWorking || (!billPo && !billAmount)}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                  style={{ gridColumn: "1 / -1", justifySelf: "start" }}
                >
                  Create bill
                </button>
                {billError && (
                  <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                    {billError}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Purchase Returns (Debit Notes) */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Purchase returns (debit notes)</h2>
          <div className={shared.card}>
            <p className={shared.hint} style={{ maxWidth: 600, marginBottom: 12 }}>
              Reduces an already-received bill — a refund, a pricing error, a return to the
              supplier. Financial only; doesn&apos;t reverse physical stock. Can&apos;t exceed
              what&apos;s still owed on the bill.
            </p>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Bill</th>
                  <th>Amount</th>
                  <th>Tax</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {purchaseReturns?.map((prt) => (
                  <tr key={prt.id}>
                    <td>{prt.debit_note_number}</td>
                    <td>{bills?.find((b) => b.id === prt.bill)?.bill_number ?? "—"}</td>
                    <td>{formatCents(prt.amount_cents)}</td>
                    <td>{formatCents(prt.tax_amount_cents)}</td>
                    <td>{prt.reason}</td>
                  </tr>
                ))}
                {purchaseReturns?.length === 0 && (
                  <tr>
                    <td colSpan={5} className={shared.tableMuted}>
                      No purchase returns yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form onSubmit={handleAddPurchaseReturn} className={shared.formGrid} style={{ marginTop: 16 }}>
                <select
                  required
                  value={prtBill}
                  onChange={(e) => setPrtBill(e.target.value)}
                  className={shared.select}
                >
                  <option value="">Bill…</option>
                  {bills?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bill_number} ({formatCents(b.amount_cents + b.tax_amount_cents)})
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Amount"
                  type="number"
                  step="0.01"
                  required
                  value={prtAmount}
                  onChange={(e) => setPrtAmount(e.target.value)}
                  className={shared.input}
                />
                <input
                  placeholder="Tax amount"
                  type="number"
                  step="0.01"
                  value={prtTax}
                  onChange={(e) => setPrtTax(e.target.value)}
                  className={shared.input}
                />
                <input
                  placeholder="Reason"
                  value={prtReason}
                  onChange={(e) => setPrtReason(e.target.value)}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={prtWorking || !prtBill || !prtAmount}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Issue debit note
                </button>
                {prtError && (
                  <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                    {prtError}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
