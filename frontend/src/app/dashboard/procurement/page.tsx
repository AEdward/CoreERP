"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { EMPTY_LINE, LineItemsEditor, type LineItemRow } from "@/components/LineItemsEditor";
import { api, ApiError, type Item, type PurchaseOrder, type Supplier } from "@/lib/api";
import { useSession } from "@/lib/useSession";

const EMPTY_SUPPLIER_FORM = { name: "", phone: "", email: "", address: "", tax_number: "" };

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function ProcurementPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [supplierForm, setSupplierForm] = useState(EMPTY_SUPPLIER_FORM);
  const [supplierWorking, setSupplierWorking] = useState(false);

  const [poSupplier, setPoSupplier] = useState("");
  const [poStatus, setPoStatus] = useState<PurchaseOrder["status"]>("draft");
  const [poLines, setPoLines] = useState<LineItemRow[]>([{ ...EMPTY_LINE }]);
  const [poWorking, setPoWorking] = useState(false);
  const [poError, setPoError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [s, i, o] = await Promise.all([
        api.listSuppliers(),
        api.listItems(),
        api.listPurchaseOrders(),
      ]);
      setSuppliers(s);
      setItems(i);
      setOrders(o);
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
      await api.createSupplier(supplierForm);
      setSupplierForm(EMPTY_SUPPLIER_FORM);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to create supplier.");
    } finally {
      setSupplierWorking(false);
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
      await api.createPurchaseOrder({ supplier: Number(poSupplier), status: poStatus, lines });
      setPoSupplier("");
      setPoStatus("draft");
      setPoLines([{ ...EMPTY_LINE }]);
      await loadAll();
    } catch (err) {
      setPoError(err instanceof ApiError ? err.message : "Failed to create purchase order.");
    } finally {
      setPoWorking(false);
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
                </tr>
              </thead>
              <tbody>
                {suppliers?.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{s.name}</td>
                    <td style={{ padding: "6px 4px" }}>{s.phone || "—"}</td>
                    <td style={{ padding: "6px 4px" }}>{s.email || "—"}</td>
                    <td style={{ padding: "6px 4px" }}>{s.tax_number || "—"}</td>
                  </tr>
                ))}
                {suppliers?.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: "6px 4px", color: "#999" }}>
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
                <button
                  type="submit"
                  disabled={supplierWorking || !supplierForm.name}
                  style={{ padding: "8px 16px", gridColumn: "1 / -1", justifySelf: "start" }}
                >
                  Add supplier
                </button>
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
                </tr>
              </thead>
              <tbody>
                {orders?.map((o) => (
                  <tr key={o.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{supplierName(o.supplier)}</td>
                    <td style={{ padding: "6px 4px" }}>{o.status}</td>
                    <td style={{ padding: "6px 4px" }}>{o.lines.length}</td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(o.total_cents)}</td>
                  </tr>
                ))}
                {orders?.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: "6px 4px", color: "#999" }}>
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
                <button
                  type="submit"
                  disabled={poWorking || !poSupplier}
                  style={{ padding: "8px 16px", marginTop: 8 }}
                >
                  Create purchase order
                </button>
                {poError && <p style={{ color: "crimson" }}>{poError}</p>}
              </form>
            )}
          </section>
        </>
      )}
    </main>
  );
}
