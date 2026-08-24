"use client";

import { Fragment, useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { EMPTY_LINE, LineItemsEditor, type LineItemRow } from "@/components/LineItemsEditor";
import { ActivityPanel } from "@/components/ActivityPanel";
import { DocumentsPanel } from "@/components/DocumentsPanel";
import { NotesPanel } from "@/components/NotesPanel";
import { RowActions } from "@/components/RowActions";
import {
  api,
  ApiError,
  type CreditNote,
  type Customer,
  type Invoice,
  type Item,
  type OrderLine,
  type Quotation,
  type SalesOrder,
  type Warehouse,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";

const EMPTY_CUSTOMER_FORM = {
  name: "",
  phone: "",
  email: "",
  type: "individual" as Customer["type"],
  address: "",
};

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

function linesToPayload(rows: LineItemRow[]) {
  return rows
    .filter((l) => l.item && l.quantity)
    .map((l) => ({
      item: Number(l.item),
      quantity: Number(l.quantity),
      unit_price_cents: Math.round(Number(l.unitPrice || 0) * 100),
      discount_percent: Number(l.discountPercent || 0),
    }));
}

function linesToRows(lines: OrderLine[]): LineItemRow[] {
  return lines.map((l) => ({
    item: String(l.item),
    quantity: String(l.quantity),
    unitPrice: (l.unit_price_cents / 100).toString(),
    discountPercent: String(l.discount_percent),
  }));
}

export default function SalesPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [quotations, setQuotations] = useState<Quotation[] | null>(null);
  const [orders, setOrders] = useState<SalesOrder[] | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [creditNotes, setCreditNotes] = useState<CreditNote[] | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [customerForm, setCustomerForm] = useState(EMPTY_CUSTOMER_FORM);
  const [customerWorking, setCustomerWorking] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<number | null>(null);

  const [qCustomer, setQCustomer] = useState("");
  const [qLines, setQLines] = useState<LineItemRow[]>([{ ...EMPTY_LINE }]);
  const [qWorking, setQWorking] = useState(false);
  const [qError, setQError] = useState<string | null>(null);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);

  const [soCustomer, setSoCustomer] = useState("");
  const [soQuotation, setSoQuotation] = useState("");
  const [soLines, setSoLines] = useState<LineItemRow[]>([{ ...EMPTY_LINE }]);
  const [soWorking, setSoWorking] = useState(false);
  const [soError, setSoError] = useState<string | null>(null);
  const [editingSalesOrder, setEditingSalesOrder] = useState<SalesOrder | null>(null);

  const [invSalesOrder, setInvSalesOrder] = useState("");
  const [invAmount, setInvAmount] = useState("");
  const [invTax, setInvTax] = useState("0");
  const [invDueDate, setInvDueDate] = useState("");
  const [invWorking, setInvWorking] = useState(false);
  const [invError, setInvError] = useState<string | null>(null);

  const [cnInvoice, setCnInvoice] = useState("");
  const [cnAmount, setCnAmount] = useState("");
  const [cnTax, setCnTax] = useState("0");
  const [cnReason, setCnReason] = useState("");
  const [cnWorking, setCnWorking] = useState(false);
  const [cnError, setCnError] = useState<string | null>(null);

  const [dispatchingOrderId, setDispatchingOrderId] = useState<number | null>(null);
  const [dispatchWarehouse, setDispatchWarehouse] = useState("");
  const [dispatchQuantities, setDispatchQuantities] = useState<Record<number, string>>({});
  const [dispatchWorking, setDispatchWorking] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [c, i, q, so, inv, cn, w] = await Promise.all([
        api.listCustomers(),
        api.listItems(),
        api.listQuotations(),
        api.listSalesOrders(),
        api.listInvoices(),
        api.listCreditNotes(),
        api.listWarehouses(),
      ]);
      setCustomers(c);
      setItems(i);
      setQuotations(q);
      setOrders(so);
      setInvoices(inv);
      setCreditNotes(cn);
      setWarehouses(w);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load sales data.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    setCustomerWorking(true);
    try {
      if (editingCustomerId) {
        await api.updateCustomer(editingCustomerId, customerForm);
      } else {
        await api.createCustomer(customerForm);
      }
      setCustomerForm(EMPTY_CUSTOMER_FORM);
      setEditingCustomerId(null);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save customer.");
    } finally {
      setCustomerWorking(false);
    }
  }

  function startEditCustomer(c: Customer) {
    setEditingCustomerId(c.id);
    setCustomerForm({ name: c.name, phone: c.phone, email: c.email, type: c.type, address: c.address });
  }

  async function handleDeleteCustomer(id: number) {
    try {
      await api.deleteCustomer(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to delete customer.");
    }
  }

  async function handleAddQuotation(e: React.FormEvent) {
    e.preventDefault();
    setQWorking(true);
    setQError(null);
    try {
      const payload = {
        customer: Number(qCustomer),
        status: editingQuotation?.status ?? "draft",
        lines: linesToPayload(qLines),
      };
      if (editingQuotation) {
        await api.updateQuotation(editingQuotation.id, payload);
      } else {
        await api.createQuotation(payload);
      }
      setQCustomer("");
      setQLines([{ ...EMPTY_LINE }]);
      setEditingQuotation(null);
      await loadAll();
    } catch (err) {
      setQError(err instanceof ApiError ? err.message : "Failed to save quotation.");
    } finally {
      setQWorking(false);
    }
  }

  function startEditQuotation(q: Quotation) {
    setEditingQuotation(q);
    setQCustomer(String(q.customer));
    setQLines(linesToRows(q.lines));
  }

  async function handleDeleteQuotation(id: number) {
    try {
      await api.deleteQuotation(id);
      await loadAll();
    } catch (err) {
      setQError(err instanceof ApiError ? err.message : "Failed to delete quotation.");
    }
  }

  async function handleAddSalesOrder(e: React.FormEvent) {
    e.preventDefault();
    setSoWorking(true);
    setSoError(null);
    try {
      const payload = {
        customer: Number(soCustomer),
        quotation: soQuotation ? Number(soQuotation) : null,
        status: editingSalesOrder?.status ?? "pending",
        payment_status: editingSalesOrder?.payment_status ?? "unpaid",
        lines: linesToPayload(soLines),
      };
      if (editingSalesOrder) {
        await api.updateSalesOrder(editingSalesOrder.id, payload);
      } else {
        await api.createSalesOrder(payload);
      }
      setSoCustomer("");
      setSoQuotation("");
      setSoLines([{ ...EMPTY_LINE }]);
      setEditingSalesOrder(null);
      await loadAll();
    } catch (err) {
      setSoError(err instanceof ApiError ? err.message : "Failed to save sales order.");
    } finally {
      setSoWorking(false);
    }
  }

  function startEditSalesOrder(o: SalesOrder) {
    setEditingSalesOrder(o);
    setSoCustomer(String(o.customer));
    setSoQuotation(o.quotation ? String(o.quotation) : "");
    setSoLines(linesToRows(o.lines));
  }

  async function handleDeleteSalesOrder(id: number) {
    try {
      await api.deleteSalesOrder(id);
      await loadAll();
    } catch (err) {
      setSoError(err instanceof ApiError ? err.message : "Failed to delete sales order.");
    }
  }

  async function handleDispatch(order: SalesOrder) {
    if (!dispatchWarehouse) return;
    setDispatchWorking(true);
    setDispatchError(null);
    try {
      const lines = order.lines
        .filter((l) => Number(dispatchQuantities[l.id] || 0) > 0)
        .map((l) => ({ line: l.id, quantity: Number(dispatchQuantities[l.id]) }));
      if (lines.length === 0) {
        setDispatchError("Enter a quantity for at least one line.");
        setDispatchWorking(false);
        return;
      }
      await api.dispatchSalesOrder(order.id, { warehouse: Number(dispatchWarehouse), lines });
      setDispatchingOrderId(null);
      setDispatchWarehouse("");
      setDispatchQuantities({});
      await loadAll();
    } catch (err) {
      setDispatchError(err instanceof ApiError ? err.message : "Failed to dispatch stock.");
    } finally {
      setDispatchWorking(false);
    }
  }

  async function handleAddInvoice(e: React.FormEvent) {
    e.preventDefault();
    setInvWorking(true);
    setInvError(null);
    try {
      await api.createInvoice({
        sales_order: invSalesOrder ? Number(invSalesOrder) : null,
        amount_cents: invSalesOrder ? undefined : Math.round(Number(invAmount || 0) * 100),
        tax_amount_cents: Math.round(Number(invTax || 0) * 100),
        due_date: invDueDate || null,
      });
      setInvSalesOrder("");
      setInvAmount("");
      setInvTax("0");
      setInvDueDate("");
      await loadAll();
    } catch (err) {
      setInvError(err instanceof ApiError ? err.message : "Failed to create invoice.");
    } finally {
      setInvWorking(false);
    }
  }

  async function handleAddCreditNote(e: React.FormEvent) {
    e.preventDefault();
    setCnWorking(true);
    setCnError(null);
    try {
      await api.createCreditNote({
        invoice: Number(cnInvoice),
        amount_cents: Math.round(Number(cnAmount || 0) * 100),
        tax_amount_cents: Math.round(Number(cnTax || 0) * 100),
        reason: cnReason,
      });
      setCnInvoice("");
      setCnAmount("");
      setCnTax("0");
      setCnReason("");
      await loadAll();
    } catch (err) {
      setCnError(err instanceof ApiError ? err.message : "Failed to create credit note.");
    } finally {
      setCnWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("sales.manage") ?? false;
  const customerName = (id: number) => customers?.find((c) => c.id === id)?.name ?? "—";

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <AppHeader activeMembership={activeMembership} />

      {!activeMembership ? (
        <p style={{ color: "#666" }}>
          Pick an active company on the <a href="/dashboard">dashboard</a> first.
        </p>
      ) : (
        <>
          <h1 style={{ fontSize: 20 }}>Sales & CRM — {activeMembership.company.name}</h1>
          <p style={{ color: "#666", fontSize: 13 }}>
            <a href="/dashboard/crm">Leads, opportunities & contacts &rarr;</a>
          </p>
          {loadError && <p style={{ color: "crimson" }}>{loadError}</p>}

          {/* Customers */}
          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Customers
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Name</th>
                  <th style={{ padding: "6px 4px" }}>Type</th>
                  <th style={{ padding: "6px 4px" }}>Phone</th>
                  <th style={{ padding: "6px 4px" }}>Email</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {customers?.map((c) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{c.name}</td>
                    <td style={{ padding: "6px 4px" }}>{c.type}</td>
                    <td style={{ padding: "6px 4px" }}>{c.phone || "—"}</td>
                    <td style={{ padding: "6px 4px" }}>{c.email || "—"}</td>
                    {canManage && (
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
                        <RowActions
                          onEdit={() => startEditCustomer(c)}
                          onDelete={() => handleDeleteCustomer(c.id)}
                          disabled={customerWorking}
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {customers?.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "6px 4px", color: "#999" }}>
                      No customers yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form
                onSubmit={handleAddCustomer}
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
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  style={{ padding: 8 }}
                />
                <select
                  value={customerForm.type}
                  onChange={(e) =>
                    setCustomerForm({ ...customerForm, type: e.target.value as Customer["type"] })
                  }
                  style={{ padding: 8 }}
                >
                  <option value="individual">Individual</option>
                  <option value="business">Business</option>
                  <option value="government">Government</option>
                  <option value="vip">VIP</option>
                </select>
                <input
                  placeholder="Phone"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Email"
                  type="email"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Address"
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                  style={{ padding: 8 }}
                />
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                  <button
                    type="submit"
                    disabled={customerWorking || !customerForm.name}
                    style={{ padding: "8px 16px" }}
                  >
                    {editingCustomerId ? "Save changes" : "Add customer"}
                  </button>
                  {editingCustomerId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCustomerId(null);
                        setCustomerForm(EMPTY_CUSTOMER_FORM);
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

          {/* Quotations */}
          <section style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Quotations
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Customer</th>
                  <th style={{ padding: "6px 4px" }}>Status</th>
                  <th style={{ padding: "6px 4px" }}>Lines</th>
                  <th style={{ padding: "6px 4px" }}>Total</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {quotations?.map((q) => (
                  <tr key={q.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{customerName(q.customer)}</td>
                    <td style={{ padding: "6px 4px" }}>{q.status}</td>
                    <td style={{ padding: "6px 4px" }}>{q.lines.length}</td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(q.total_cents)}</td>
                    {canManage && (
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
                        <RowActions
                          onEdit={() => startEditQuotation(q)}
                          onDelete={() => handleDeleteQuotation(q.id)}
                          disabled={qWorking}
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {quotations?.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "6px 4px", color: "#999" }}>
                      No quotations yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddQuotation} style={{ marginTop: 16, maxWidth: 640 }}>
                <select
                  required
                  value={qCustomer}
                  onChange={(e) => setQCustomer(e.target.value)}
                  style={{ padding: 8, marginBottom: 8, width: "100%", maxWidth: 300 }}
                >
                  <option value="">Customer…</option>
                  {customers?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <LineItemsEditor
                  items={items ?? []}
                  rows={qLines}
                  onChange={setQLines}
                  priceLabel="Unit price"
                  showDiscount
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button type="submit" disabled={qWorking || !qCustomer} style={{ padding: "8px 16px" }}>
                    {editingQuotation ? "Save changes" : "Create quotation"}
                  </button>
                  {editingQuotation && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingQuotation(null);
                        setQCustomer("");
                        setQLines([{ ...EMPTY_LINE }]);
                      }}
                      style={{ padding: "8px 16px" }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {qError && <p style={{ color: "crimson" }}>{qError}</p>}
              </form>
            )}
          </section>

          {/* Sales Orders */}
          <section style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Sales orders
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Customer</th>
                  <th style={{ padding: "6px 4px" }}>Status</th>
                  <th style={{ padding: "6px 4px" }}>Payment</th>
                  <th style={{ padding: "6px 4px" }}>Total</th>
                  <th></th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {orders?.map((o) => (
                  <Fragment key={o.id}>
                    <tr style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "6px 4px" }}>{customerName(o.customer)}</td>
                      <td style={{ padding: "6px 4px" }}>{o.status}</td>
                      <td style={{ padding: "6px 4px" }}>{o.payment_status}</td>
                      <td style={{ padding: "6px 4px" }}>{formatCents(o.total_cents)}</td>
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
                        {canManage &&
                          (o.status === "pending" || o.status === "processing") &&
                          dispatchingOrderId !== o.id && (
                            <button
                              type="button"
                              onClick={() => {
                                setDispatchingOrderId(o.id);
                                setDispatchError(null);
                              }}
                              style={{ padding: "2px 8px", fontSize: 12 }}
                            >
                              Dispatch
                            </button>
                          )}
                      </td>
                      {canManage && (
                        <td style={{ padding: "6px 4px", textAlign: "right" }}>
                          <RowActions
                            onEdit={() => startEditSalesOrder(o)}
                            onDelete={() => handleDeleteSalesOrder(o.id)}
                            disabled={soWorking}
                          />
                        </td>
                      )}
                    </tr>
                    {dispatchingOrderId === o.id && (
                      <tr style={{ borderBottom: "1px solid #eee", background: "#fafafa" }}>
                        <td colSpan={6} style={{ padding: "10px 4px" }}>
                          <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                            <select
                              value={dispatchWarehouse}
                              onChange={(e) => setDispatchWarehouse(e.target.value)}
                              style={{ padding: 6 }}
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
                                placeholder="Qty to dispatch"
                                value={dispatchQuantities[line.id] ?? ""}
                                onChange={(e) =>
                                  setDispatchQuantities({ ...dispatchQuantities, [line.id]: e.target.value })
                                }
                                disabled={line.outstanding_quantity === 0}
                                style={{ padding: 6, width: 140 }}
                              />
                            </div>
                          ))}
                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <button
                              type="button"
                              disabled={dispatchWorking || !dispatchWarehouse}
                              onClick={() => handleDispatch(o)}
                              style={{ padding: "6px 12px" }}
                            >
                              Confirm dispatch
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDispatchingOrderId(null);
                                setDispatchWarehouse("");
                                setDispatchQuantities({});
                                setDispatchError(null);
                              }}
                              style={{ padding: "6px 12px" }}
                            >
                              Cancel
                            </button>
                          </div>
                          {dispatchError && <p style={{ color: "crimson" }}>{dispatchError}</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {orders?.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "6px 4px", color: "#999" }}>
                      No sales orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddSalesOrder} style={{ marginTop: 16, maxWidth: 640 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <select
                    required
                    value={soCustomer}
                    onChange={(e) => setSoCustomer(e.target.value)}
                    style={{ padding: 8, flex: 1 }}
                  >
                    <option value="">Customer…</option>
                    {customers?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={soQuotation}
                    onChange={(e) => setSoQuotation(e.target.value)}
                    style={{ padding: 8, flex: 1 }}
                  >
                    <option value="">No linked quotation</option>
                    {quotations?.map((q) => (
                      <option key={q.id} value={q.id}>
                        Q-{q.id} ({customerName(q.customer)})
                      </option>
                    ))}
                  </select>
                </div>
                <LineItemsEditor
                  items={items ?? []}
                  rows={soLines}
                  onChange={setSoLines}
                  priceLabel="Unit price"
                  showDiscount
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button type="submit" disabled={soWorking || !soCustomer} style={{ padding: "8px 16px" }}>
                    {editingSalesOrder ? "Save changes" : "Create sales order"}
                  </button>
                  {editingSalesOrder && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSalesOrder(null);
                        setSoCustomer("");
                        setSoQuotation("");
                        setSoLines([{ ...EMPTY_LINE }]);
                      }}
                      style={{ padding: "8px 16px" }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {soError && <p style={{ color: "crimson" }}>{soError}</p>}
              </form>
            )}
          </section>

          {/* Invoices */}
          <section style={{ marginTop: 40, marginBottom: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Invoices
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Number</th>
                  <th style={{ padding: "6px 4px" }}>Amount</th>
                  <th style={{ padding: "6px 4px" }}>Tax</th>
                  <th style={{ padding: "6px 4px" }}>Due date</th>
                  <th style={{ padding: "6px 4px" }}>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices?.map((inv) => (
                  <tr key={inv.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{inv.invoice_number}</td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(inv.amount_cents)}</td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(inv.tax_amount_cents)}</td>
                    <td style={{ padding: "6px 4px" }}>{inv.due_date || "—"}</td>
                    <td style={{ padding: "6px 4px" }}>{inv.status}</td>
                    <td style={{ padding: "6px 4px", textAlign: "right" }}>
                      <span style={{ display: "inline-flex", gap: 6 }}>
                        <DocumentsPanel
                          target={{ appLabel: "sales", model: "invoice", objectId: inv.id }}
                          canManage={canManage}
                        />
                        <NotesPanel
                          target={{ appLabel: "sales", model: "invoice", objectId: inv.id }}
                          canManage={canManage}
                        />
                        <ActivityPanel target={{ appLabel: "sales", model: "invoice", objectId: inv.id }} />
                      </span>
                    </td>
                  </tr>
                ))}
                {invoices?.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "6px 4px", color: "#999" }}>
                      No invoices yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form
                onSubmit={handleAddInvoice}
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 8,
                  maxWidth: 720,
                }}
              >
                <select
                  value={invSalesOrder}
                  onChange={(e) => setInvSalesOrder(e.target.value)}
                  style={{ padding: 8 }}
                >
                  <option value="">No linked sales order (manual amount)</option>
                  {orders?.map((o) => (
                    <option key={o.id} value={o.id}>
                      SO-{o.id} ({customerName(o.customer)}) — {formatCents(o.total_cents)}
                    </option>
                  ))}
                </select>
                {!invSalesOrder && (
                  <input
                    placeholder="Amount"
                    type="number"
                    step="0.01"
                    value={invAmount}
                    onChange={(e) => setInvAmount(e.target.value)}
                    style={{ padding: 8 }}
                  />
                )}
                {!invSalesOrder && (
                  <input
                    placeholder="Tax amount"
                    type="number"
                    step="0.01"
                    value={invTax}
                    onChange={(e) => setInvTax(e.target.value)}
                    style={{ padding: 8 }}
                  />
                )}
                <input
                  type="date"
                  value={invDueDate}
                  onChange={(e) => setInvDueDate(e.target.value)}
                  style={{ padding: 8 }}
                />
                <button
                  type="submit"
                  disabled={invWorking || (!invSalesOrder && !invAmount)}
                  style={{ padding: "8px 16px", gridColumn: "1 / -1", justifySelf: "start" }}
                >
                  Create invoice
                </button>
                {invError && (
                  <p style={{ color: "crimson", gridColumn: "1 / -1", margin: 0 }}>{invError}</p>
                )}
              </form>
            )}
          </section>

          {/* Credit Notes */}
          <section style={{ marginTop: 40, marginBottom: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Credit notes
            </h2>
            <p style={{ fontSize: 12, color: "#999", maxWidth: 600 }}>
              Reduces an already-issued invoice — a refund, a pricing error, a partial return.
              Can&apos;t exceed what&apos;s still owed on the invoice.
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Number</th>
                  <th style={{ padding: "6px 4px" }}>Invoice</th>
                  <th style={{ padding: "6px 4px" }}>Amount</th>
                  <th style={{ padding: "6px 4px" }}>Tax</th>
                  <th style={{ padding: "6px 4px" }}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {creditNotes?.map((cn) => (
                  <tr key={cn.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{cn.credit_note_number}</td>
                    <td style={{ padding: "6px 4px" }}>
                      {invoices?.find((inv) => inv.id === cn.invoice)?.invoice_number ?? "—"}
                    </td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(cn.amount_cents)}</td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(cn.tax_amount_cents)}</td>
                    <td style={{ padding: "6px 4px" }}>{cn.reason}</td>
                  </tr>
                ))}
                {creditNotes?.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "6px 4px", color: "#999" }}>
                      No credit notes yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form
                onSubmit={handleAddCreditNote}
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 8,
                  maxWidth: 800,
                }}
              >
                <select
                  required
                  value={cnInvoice}
                  onChange={(e) => setCnInvoice(e.target.value)}
                  style={{ padding: 8 }}
                >
                  <option value="">Invoice…</option>
                  {invoices?.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} ({formatCents(inv.amount_cents + inv.tax_amount_cents)})
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Amount"
                  type="number"
                  step="0.01"
                  required
                  value={cnAmount}
                  onChange={(e) => setCnAmount(e.target.value)}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Tax amount"
                  type="number"
                  step="0.01"
                  value={cnTax}
                  onChange={(e) => setCnTax(e.target.value)}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Reason"
                  value={cnReason}
                  onChange={(e) => setCnReason(e.target.value)}
                  style={{ padding: 8 }}
                />
                <button
                  type="submit"
                  disabled={cnWorking || !cnInvoice || !cnAmount}
                  style={{ padding: "8px 16px" }}
                >
                  Issue credit note
                </button>
                {cnError && (
                  <p style={{ color: "crimson", gridColumn: "1 / -1", margin: 0 }}>{cnError}</p>
                )}
              </form>
            )}
          </section>
        </>
      )}
    </main>
  );
}
