"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { EMPTY_LINE, LineItemsEditor, type LineItemRow } from "@/components/LineItemsEditor";
import { ActivityPanel } from "@/components/ActivityPanel";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { NotesPanel } from "@/components/NotesPanel";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type Bill, type Item, type PurchaseOrder, type Supplier } from "@/lib/api";
import { useSession } from "@/lib/useSession";

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

export default function ProcurementPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[] | null>(null);
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER_FORM);
  const [supplierWorking, setSupplierWorking] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);

  const [poSupplier, setPoSupplier] = useState("");
  const [poStatus, setPoStatus] = useState<PurchaseOrder["status"]>("draft");
  const [poLines, setPoLines] = useState<LineItemRow[]>([{ ...EMPTY_LINE }]);
  const [poWorking, setPoWorking] = useState(false);
  const [poError, setPoError] = useState<string | null>(null);
  const [editingPoId, setEditingPoId] = useState<number | null>(null);

  const [billPo, setBillPo] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billTax, setBillTax] = useState("0");
  const [billDueDate, setBillDueDate] = useState("");
  const [billWorking, setBillWorking] = useState(false);
  const [billError, setBillError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [s, i, o, b] = await Promise.all([
        api.listSuppliers(),
        api.listItems(),
        api.listPurchaseOrders(),
        api.listBills(),
      ]);
      setSuppliers(s);
      setItems(i);
      setOrders(o);
      setBills(b);
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

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("procurement.manage") ?? false;
  const supplierName = (id: number) => suppliers?.find((s) => s.id === id)?.name ?? "—";

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <AppHeader activeMembership={activeMembership} />

      {!activeMembership ? (
        <p style={{ color: "#666" }}>
          Pick an active company on the <a href="/dashboard">dashboard</a> first.
        </p>
      ) : (
        <>
          <h1 style={{ fontSize: 20 }}>Procurement — {activeMembership.company.name}</h1>
          {loadError && <p style={{ color: "crimson" }}>{loadError}</p>}

          {/* Suppliers */}
          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Suppliers
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Name</th>
                  <th style={{ padding: "6px 4px" }}>Phone</th>
                  <th style={{ padding: "6px 4px" }}>Email</th>
                  <th style={{ padding: "6px 4px" }}>Tax number</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {suppliers?.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{s.name}</td>
                    <td style={{ padding: "6px 4px" }}>{s.phone || "—"}</td>
                    <td style={{ padding: "6px 4px" }}>{s.email || "—"}</td>
                    <td style={{ padding: "6px 4px" }}>{s.tax_number || "—"}</td>
                    {canManage && (
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
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
                    <td colSpan={5} style={{ padding: "6px 4px", color: "#999" }}>
                      No suppliers yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form
                onSubmit={handleAddSupplier}
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 8,
                  maxWidth: 720,
                }}
              >
                <input
                  placeholder="Name"
                  required
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Phone"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Email"
                  type="email"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Address"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Tax number"
                  value={supplierForm.tax_number}
                  onChange={(e) => setSupplierForm({ ...supplierForm, tax_number: e.target.value })}
                  style={{ padding: 8 }}
                />
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                  <button
                    type="submit"
                    disabled={supplierWorking || !supplierForm.name}
                    style={{ padding: "8px 16px" }}
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
                      style={{ padding: "8px 16px" }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}
          </section>

          {/* Purchase Orders */}
          <section style={{ marginTop: 40, marginBottom: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Purchase orders
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Supplier</th>
                  <th style={{ padding: "6px 4px" }}>Status</th>
                  <th style={{ padding: "6px 4px" }}>Lines</th>
                  <th style={{ padding: "6px 4px" }}>Total</th>
                  <th></th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {orders?.map((o) => (
                  <tr key={o.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{supplierName(o.supplier)}</td>
                    <td style={{ padding: "6px 4px" }}>{o.status}</td>
                    <td style={{ padding: "6px 4px" }}>{o.lines.length}</td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(o.total_cents)}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>
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
                      </span>
                    </td>
                    {canManage && (
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
                        <RowActions
                          onEdit={() => startEditPurchaseOrder(o)}
                          onDelete={() => handleDeletePurchaseOrder(o.id)}
                          disabled={poWorking}
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {orders?.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "6px 4px", color: "#999" }}>
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
                    style={{ padding: 8, flex: 1 }}
                  >
                    <option value="">Supplier…</option>
                    {suppliers?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={poStatus}
                    onChange={(e) => setPoStatus(e.target.value as PurchaseOrder["status"])}
                    style={{ padding: 8 }}
                  >
                    <option value="draft">Draft</option>
                    <option value="submitted">Submitted</option>
                    <option value="approved">Approved</option>
                    <option value="received">Received</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <LineItemsEditor
                  items={items ?? []}
                  rows={poLines}
                  onChange={setPoLines}
                  priceLabel="Unit cost"
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button type="submit" disabled={poWorking || !poSupplier} style={{ padding: "8px 16px" }}>
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
                      style={{ padding: "8px 16px" }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {poError && <p style={{ color: "crimson" }}>{poError}</p>}
              </form>
            )}
          </section>

          {/* Bills (AP) */}
          <section style={{ marginTop: 40, marginBottom: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Bills
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Number</th>
                  <th style={{ padding: "6px 4px" }}>Amount</th>
                  <th style={{ padding: "6px 4px" }}>Tax</th>
                  <th style={{ padding: "6px 4px" }}>Due date</th>
                  <th style={{ padding: "6px 4px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {bills?.map((bill) => (
                  <tr key={bill.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{bill.bill_number}</td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(bill.amount_cents)}</td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(bill.tax_amount_cents)}</td>
                    <td style={{ padding: "6px 4px" }}>{bill.due_date || "—"}</td>
                    <td style={{ padding: "6px 4px" }}>{bill.status}</td>
                  </tr>
                ))}
                {bills?.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "6px 4px", color: "#999" }}>
                      No bills yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form
                onSubmit={handleAddBill}
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 8,
                  maxWidth: 720,
                }}
              >
                <select value={billPo} onChange={(e) => setBillPo(e.target.value)} style={{ padding: 8 }}>
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
                    style={{ padding: 8 }}
                  />
                )}
                <input
                  placeholder="Tax amount"
                  type="number"
                  step="0.01"
                  value={billTax}
                  onChange={(e) => setBillTax(e.target.value)}
                  style={{ padding: 8 }}
                />
                <input
                  type="date"
                  value={billDueDate}
                  onChange={(e) => setBillDueDate(e.target.value)}
                  style={{ padding: 8 }}
                />
                <button
                  type="submit"
                  disabled={billWorking || (!billPo && !billAmount)}
                  style={{ padding: "8px 16px", gridColumn: "1 / -1", justifySelf: "start" }}
                >
                  Create bill
                </button>
                {billError && (
                  <p style={{ color: "crimson", gridColumn: "1 / -1", margin: 0 }}>{billError}</p>
                )}
              </form>
            )}
          </section>
        </>
      )}
    </main>
  );
}
