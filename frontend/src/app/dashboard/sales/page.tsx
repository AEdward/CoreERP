"use client";

import { Fragment, useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
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
import shared from "@/styles/shared.module.css";

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

const STATUS_BADGE: Record<string, string> = {
  draft: "badgeInfo",
  pending: "badgeWarn",
  processing: "badgeWarn",
  approved: "badgeSuccess",
  confirmed: "badgeSuccess",
  completed: "badgeSuccess",
  delivered: "badgeSuccess",
  paid: "badgeSuccess",
  partially_paid: "badgeWarn",
  unpaid: "badgeDanger",
  overdue: "badgeDanger",
  cancelled: "badgeDanger",
  rejected: "badgeDanger",
};

function statusBadgeClass(status: string) {
  const key = STATUS_BADGE[status] ?? "badgeInfo";
  return `${shared.badge} ${shared[key]}`;
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

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("sales.manage") ?? false;
  const customerName = (id: number) => customers?.find((c) => c.id === id)?.name ?? "—";

  return (
    <ModuleShell moduleKey="sales" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Sales & CRM</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
          <div className={shared.pageActions}>
            <a href="/dashboard/crm" className={shared.btn}>
              Leads, opportunities & contacts &rarr;
            </a>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        {/* Customers */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Customers</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Phone</th>
                  <th>Email</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {customers?.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.type}</td>
                    <td>{c.phone || "—"}</td>
                    <td>{c.email || "—"}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
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
                    <td colSpan={5} className={shared.tableMuted}>
                      No customers yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddCustomer} className={shared.formGrid} style={{ marginTop: 16 }}>
                <input
                  placeholder="Name"
                  required
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  className={shared.input}
                />
                <select
                  value={customerForm.type}
                  onChange={(e) =>
                    setCustomerForm({ ...customerForm, type: e.target.value as Customer["type"] })
                  }
                  className={shared.select}
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
                  className={shared.input}
                />
                <input
                  placeholder="Email"
                  type="email"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Address"
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                  className={shared.input}
                />
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                  <button
                    type="submit"
                    disabled={customerWorking || !customerForm.name}
                    className={`${shared.btn} ${shared.btnPrimary}`}
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

        {/* Quotations */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Quotations</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Lines</th>
                  <th>Total</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {quotations?.map((q) => (
                  <tr key={q.id}>
                    <td>{customerName(q.customer)}</td>
                    <td>
                      <span className={statusBadgeClass(q.status)}>{q.status}</span>
                    </td>
                    <td>{q.lines.length}</td>
                    <td>{formatCents(q.total_cents)}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
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
                    <td colSpan={5} className={shared.tableMuted}>
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
                  className={shared.select}
                  style={{ marginBottom: 8, width: "100%", maxWidth: 300 }}
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
                  <button
                    type="submit"
                    disabled={qWorking || !qCustomer}
                    className={`${shared.btn} ${shared.btnPrimary}`}
                  >
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
                      className={shared.btn}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {qError && <p className={shared.errorText}>{qError}</p>}
              </form>
            )}
          </div>
        </div>

        {/* Sales Orders */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Sales orders</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th></th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {orders?.map((o) => (
                  <Fragment key={o.id}>
                    <tr>
                      <td>{customerName(o.customer)}</td>
                      <td>
                        <span className={statusBadgeClass(o.status)}>{o.status}</span>
                      </td>
                      <td>
                        <span className={statusBadgeClass(o.payment_status)}>{o.payment_status}</span>
                      </td>
                      <td>{formatCents(o.total_cents)}</td>
                      <td style={{ textAlign: "right" }}>
                        {canManage &&
                          (o.status === "pending" || o.status === "processing") &&
                          dispatchingOrderId !== o.id && (
                            <button
                              type="button"
                              onClick={() => {
                                setDispatchingOrderId(o.id);
                                setDispatchError(null);
                              }}
                              className={`${shared.btn} ${shared.btnSmall}`}
                            >
                              Dispatch
                            </button>
                          )}
                      </td>
                      {canManage && (
                        <td style={{ textAlign: "right" }}>
                          <RowActions
                            onEdit={() => startEditSalesOrder(o)}
                            onDelete={() => handleDeleteSalesOrder(o.id)}
                            disabled={soWorking}
                          />
                        </td>
                      )}
                    </tr>
                    {dispatchingOrderId === o.id && (
                      <tr style={{ background: "var(--gray-50)" }}>
                        <td colSpan={6} style={{ padding: "10px 8px" }}>
                          <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                            <select
                              value={dispatchWarehouse}
                              onChange={(e) => setDispatchWarehouse(e.target.value)}
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
                                placeholder="Qty to dispatch"
                                value={dispatchQuantities[line.id] ?? ""}
                                onChange={(e) =>
                                  setDispatchQuantities({ ...dispatchQuantities, [line.id]: e.target.value })
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
                              disabled={dispatchWorking || !dispatchWarehouse}
                              onClick={() => handleDispatch(o)}
                              className={`${shared.btn} ${shared.btnPrimary}`}
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
                              className={shared.btn}
                            >
                              Cancel
                            </button>
                          </div>
                          {dispatchError && <p className={shared.errorText}>{dispatchError}</p>}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {orders?.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
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
                    className={shared.select}
                    style={{ flex: 1 }}
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
                    className={shared.select}
                    style={{ flex: 1 }}
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
                  <button
                    type="submit"
                    disabled={soWorking || !soCustomer}
                    className={`${shared.btn} ${shared.btnPrimary}`}
                  >
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
                      className={shared.btn}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {soError && <p className={shared.errorText}>{soError}</p>}
              </form>
            )}
          </div>
        </div>

        {/* Invoices */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Invoices</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Amount</th>
                  <th>Tax</th>
                  <th>Due date</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invoices?.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.invoice_number}</td>
                    <td>{formatCents(inv.amount_cents)}</td>
                    <td>{formatCents(inv.tax_amount_cents)}</td>
                    <td>{inv.due_date || "—"}</td>
                    <td>
                      <span className={statusBadgeClass(inv.status)}>{inv.status}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
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
                    <td colSpan={6} className={shared.tableMuted}>
                      No invoices yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddInvoice} className={shared.formGrid} style={{ marginTop: 16 }}>
                <select
                  value={invSalesOrder}
                  onChange={(e) => setInvSalesOrder(e.target.value)}
                  className={shared.select}
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
                    className={shared.input}
                  />
                )}
                {!invSalesOrder && (
                  <input
                    placeholder="Tax amount"
                    type="number"
                    step="0.01"
                    value={invTax}
                    onChange={(e) => setInvTax(e.target.value)}
                    className={shared.input}
                  />
                )}
                <input
                  type="date"
                  value={invDueDate}
                  onChange={(e) => setInvDueDate(e.target.value)}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={invWorking || (!invSalesOrder && !invAmount)}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                  style={{ gridColumn: "1 / -1", justifySelf: "start" }}
                >
                  Create invoice
                </button>
                {invError && (
                  <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                    {invError}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Credit Notes */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Credit notes</h2>
          <div className={shared.card}>
            <p className={shared.hint} style={{ maxWidth: 600, marginBottom: 12 }}>
              Reduces an already-issued invoice — a refund, a pricing error, a partial return.
              Can&apos;t exceed what&apos;s still owed on the invoice.
            </p>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Invoice</th>
                  <th>Amount</th>
                  <th>Tax</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {creditNotes?.map((cn) => (
                  <tr key={cn.id}>
                    <td>{cn.credit_note_number}</td>
                    <td>{invoices?.find((inv) => inv.id === cn.invoice)?.invoice_number ?? "—"}</td>
                    <td>{formatCents(cn.amount_cents)}</td>
                    <td>{formatCents(cn.tax_amount_cents)}</td>
                    <td>{cn.reason}</td>
                  </tr>
                ))}
                {creditNotes?.length === 0 && (
                  <tr>
                    <td colSpan={5} className={shared.tableMuted}>
                      No credit notes yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form onSubmit={handleAddCreditNote} className={shared.formGrid} style={{ marginTop: 16 }}>
                <select
                  required
                  value={cnInvoice}
                  onChange={(e) => setCnInvoice(e.target.value)}
                  className={shared.select}
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
                  className={shared.input}
                />
                <input
                  placeholder="Tax amount"
                  type="number"
                  step="0.01"
                  value={cnTax}
                  onChange={(e) => setCnTax(e.target.value)}
                  className={shared.input}
                />
                <input
                  placeholder="Reason"
                  value={cnReason}
                  onChange={(e) => setCnReason(e.target.value)}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={cnWorking || !cnInvoice || !cnAmount}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Issue credit note
                </button>
                {cnError && (
                  <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                    {cnError}
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
