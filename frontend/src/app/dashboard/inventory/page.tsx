"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { RowActions } from "@/components/RowActions";
import {
  api,
  ApiError,
  type Branch,
  type Item,
  type Stock,
  type StockMovement,
  type TaxRate,
  type Warehouse,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";

const EMPTY_ITEM_FORM = {
  type: "product" as Item["type"],
  name: "",
  category: "",
  price: "",
  cost: "",
  tax_rate: "",
};

const EMPTY_WAREHOUSE_FORM = { name: "", location: "", branch: "" };

const EMPTY_MOVEMENT_FORM = {
  type: "in" as StockMovement["type"],
  item: "",
  warehouse: "",
  to_warehouse: "",
  quantity: "",
  reference: "",
};

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function InventoryPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [items, setItems] = useState<Item[] | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null);
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [stock, setStock] = useState<Stock[] | null>(null);
  const [movements, setMovements] = useState<StockMovement[] | null>(null);
  const [taxRates, setTaxRates] = useState<TaxRate[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [itemForm, setItemForm] = useState(EMPTY_ITEM_FORM);
  const [itemWorking, setItemWorking] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);

  const [warehouseForm, setWarehouseForm] = useState(EMPTY_WAREHOUSE_FORM);
  const [warehouseWorking, setWarehouseWorking] = useState(false);
  const [editingWarehouseId, setEditingWarehouseId] = useState<number | null>(null);

  const [movementForm, setMovementForm] = useState(EMPTY_MOVEMENT_FORM);
  const [movementWorking, setMovementWorking] = useState(false);
  const [movementError, setMovementError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [i, w, br, s, m, tr] = await Promise.all([
        api.listItems(),
        api.listWarehouses(),
        api.listBranches(),
        api.listStock(),
        api.listStockMovements(),
        api.listTaxRates(),
      ]);
      setItems(i);
      setWarehouses(w);
      setBranches(br);
      setStock(s);
      setMovements(m);
      setTaxRates(tr);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load inventory data.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    setItemWorking(true);
    setItemError(null);
    try {
      const payload = {
        type: itemForm.type,
        name: itemForm.name,
        category: itemForm.category,
        price_cents: Math.round(Number(itemForm.price || 0) * 100),
        cost_cents: Math.round(Number(itemForm.cost || 0) * 100),
        tax_rate: itemForm.tax_rate ? Number(itemForm.tax_rate) : null,
      };
      if (editingItemId) {
        await api.updateItem(editingItemId, payload);
      } else {
        await api.createItem(payload);
      }
      setItemForm(EMPTY_ITEM_FORM);
      setEditingItemId(null);
      await loadAll();
    } catch (err) {
      setItemError(err instanceof ApiError ? err.message : "Failed to save item.");
    } finally {
      setItemWorking(false);
    }
  }

  function startEditItem(item: Item) {
    setEditingItemId(item.id);
    setItemForm({
      type: item.type,
      name: item.name,
      category: item.category,
      price: (item.price_cents / 100).toString(),
      cost: (item.cost_cents / 100).toString(),
      tax_rate: item.tax_rate ? String(item.tax_rate) : "",
    });
  }

  async function handleDeleteItem(id: number) {
    try {
      await api.deleteItem(id);
      await loadAll();
    } catch (err) {
      setItemError(err instanceof ApiError ? err.message : "Failed to delete item.");
    }
  }

  async function handleAddWarehouse(e: React.FormEvent) {
    e.preventDefault();
    setWarehouseWorking(true);
    try {
      const payload = {
        name: warehouseForm.name,
        location: warehouseForm.location,
        branch: warehouseForm.branch ? Number(warehouseForm.branch) : null,
      };
      if (editingWarehouseId) {
        await api.updateWarehouse(editingWarehouseId, payload);
      } else {
        await api.createWarehouse(payload);
      }
      setWarehouseForm(EMPTY_WAREHOUSE_FORM);
      setEditingWarehouseId(null);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save warehouse.");
    } finally {
      setWarehouseWorking(false);
    }
  }

  function startEditWarehouse(w: Warehouse) {
    setEditingWarehouseId(w.id);
    setWarehouseForm({
      name: w.name,
      location: w.location,
      branch: w.branch ? String(w.branch) : "",
    });
  }

  async function handleDeleteWarehouse(id: number) {
    try {
      await api.deleteWarehouse(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to delete warehouse.");
    }
  }

  async function handleAddMovement(e: React.FormEvent) {
    e.preventDefault();
    setMovementWorking(true);
    setMovementError(null);
    try {
      await api.createStockMovement({
        type: movementForm.type,
        item: Number(movementForm.item),
        warehouse: Number(movementForm.warehouse),
        to_warehouse:
          movementForm.type === "transfer" && movementForm.to_warehouse
            ? Number(movementForm.to_warehouse)
            : null,
        quantity: Number(movementForm.quantity),
        reference: movementForm.reference,
      });
      setMovementForm(EMPTY_MOVEMENT_FORM);
      await loadAll();
    } catch (err) {
      setMovementError(err instanceof ApiError ? err.message : "Failed to record movement.");
    } finally {
      setMovementWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("inventory.manage") ?? false;
  const itemName = (id: number) => items?.find((i) => i.id === id)?.name ?? "—";
  const warehouseName = (id: number | null) => warehouses?.find((w) => w.id === id)?.name ?? "—";
  const branchName = (id: number | null) => branches?.find((b) => b.id === id)?.name ?? "—";
  const taxRateLabel = (id: number | null) => {
    if (!id) return "—";
    const t = taxRates?.find((r) => r.id === id);
    return t ? `${t.name} (${t.rate_percent}%)` : "—";
  };

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <AppHeader activeMembership={activeMembership} />

      {!activeMembership ? (
        <p style={{ color: "#666" }}>
          Pick an active company on the <a href="/dashboard">dashboard</a> first.
        </p>
      ) : (
        <>
          <h1 style={{ fontSize: 20 }}>Inventory & Catalog — {activeMembership.company.name}</h1>
          <p style={{ color: "#666", fontSize: 13 }}>
            <a href="/dashboard/inventory/stock-counts">Stock counts &rarr;</a>
          </p>
          {loadError && <p style={{ color: "crimson" }}>{loadError}</p>}

          {/* Items */}
          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Items
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Name</th>
                  <th style={{ padding: "6px 4px" }}>Type</th>
                  <th style={{ padding: "6px 4px" }}>Category</th>
                  <th style={{ padding: "6px 4px" }}>Price</th>
                  <th style={{ padding: "6px 4px" }}>Cost</th>
                  <th style={{ padding: "6px 4px" }}>Tax</th>
                  <th style={{ padding: "6px 4px" }}>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {items?.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{item.name}</td>
                    <td style={{ padding: "6px 4px" }}>{item.type}</td>
                    <td style={{ padding: "6px 4px" }}>{item.category || "—"}</td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(item.price_cents)}</td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(item.cost_cents)}</td>
                    <td style={{ padding: "6px 4px" }}>{taxRateLabel(item.tax_rate)}</td>
                    <td style={{ padding: "6px 4px" }}>{item.status}</td>
                    {canManage && (
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
                        <RowActions
                          onEdit={() => startEditItem(item)}
                          onDelete={() => handleDeleteItem(item.id)}
                          disabled={itemWorking}
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {items?.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: "6px 4px", color: "#999" }}>
                      No items yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form
                onSubmit={handleAddItem}
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 8,
                  maxWidth: 720,
                }}
              >
                <select
                  value={itemForm.type}
                  onChange={(e) => setItemForm({ ...itemForm, type: e.target.value as Item["type"] })}
                  style={{ padding: 8 }}
                >
                  <option value="product">Product</option>
                  <option value="service">Service</option>
                </select>
                <input
                  placeholder="Name"
                  required
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Category"
                  value={itemForm.category}
                  onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Price"
                  type="number"
                  step="0.01"
                  value={itemForm.price}
                  onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Cost"
                  type="number"
                  step="0.01"
                  value={itemForm.cost}
                  onChange={(e) => setItemForm({ ...itemForm, cost: e.target.value })}
                  style={{ padding: 8 }}
                />
                <select
                  value={itemForm.tax_rate}
                  onChange={(e) => setItemForm({ ...itemForm, tax_rate: e.target.value })}
                  style={{ padding: 8 }}
                >
                  <option value="">No tax</option>
                  {taxRates
                    ?.filter((t) => t.is_active)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.rate_percent}%)
                      </option>
                    ))}
                </select>
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
                  <button type="submit" disabled={itemWorking || !itemForm.name} style={{ padding: "8px 16px" }}>
                    {editingItemId ? "Save changes" : "Add item"}
                  </button>
                  {editingItemId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItemId(null);
                        setItemForm(EMPTY_ITEM_FORM);
                      }}
                      style={{ padding: "8px 16px" }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {itemError && (
                  <p style={{ color: "crimson", gridColumn: "1 / -1", margin: 0 }}>{itemError}</p>
                )}
              </form>
            )}
          </section>

          {/* Warehouses */}
          <section style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Warehouses
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <tbody>
                {warehouses?.map((w) => (
                  <tr key={w.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{w.name}</td>
                    <td style={{ padding: "6px 4px", color: "#666" }}>{w.location || "—"}</td>
                    <td style={{ padding: "6px 4px", color: "#666" }}>{branchName(w.branch)}</td>
                    {canManage && (
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
                        <RowActions
                          onEdit={() => startEditWarehouse(w)}
                          onDelete={() => handleDeleteWarehouse(w.id)}
                          disabled={warehouseWorking}
                        />
                      </td>
                    )}
                  </tr>
                ))}
                {warehouses?.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: "6px 4px", color: "#999" }}>
                      No warehouses yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddWarehouse} style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <input
                  placeholder="Warehouse name"
                  required
                  value={warehouseForm.name}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                  style={{ padding: 8, flex: 1, maxWidth: 240 }}
                />
                <input
                  placeholder="Location"
                  value={warehouseForm.location}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, location: e.target.value })}
                  style={{ padding: 8, flex: 1, maxWidth: 240 }}
                />
                <select
                  value={warehouseForm.branch}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, branch: e.target.value })}
                  style={{ padding: 8 }}
                >
                  <option value="">No branch</option>
                  {branches?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={warehouseWorking || !warehouseForm.name}
                  style={{ padding: "8px 16px" }}
                >
                  {editingWarehouseId ? "Save changes" : "Add warehouse"}
                </button>
                {editingWarehouseId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingWarehouseId(null);
                      setWarehouseForm(EMPTY_WAREHOUSE_FORM);
                    }}
                    style={{ padding: "8px 16px" }}
                  >
                    Cancel
                  </button>
                )}
              </form>
            )}
          </section>

          {/* Stock levels */}
          <section style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Stock levels
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Item</th>
                  <th style={{ padding: "6px 4px" }}>Warehouse</th>
                  <th style={{ padding: "6px 4px" }}>Quantity</th>
                  <th style={{ padding: "6px 4px" }}>Minimum</th>
                </tr>
              </thead>
              <tbody>
                {stock?.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{s.item_name}</td>
                    <td style={{ padding: "6px 4px" }}>{s.warehouse_name}</td>
                    <td
                      style={{
                        padding: "6px 4px",
                        color: s.quantity <= s.minimum_stock ? "crimson" : "inherit",
                      }}
                    >
                      {s.quantity}
                    </td>
                    <td style={{ padding: "6px 4px" }}>{s.minimum_stock}</td>
                  </tr>
                ))}
                {stock?.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: "6px 4px", color: "#999" }}>
                      No stock recorded yet — add a movement below.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {/* Stock movements */}
          <section style={{ marginTop: 40, marginBottom: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Stock movements
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Type</th>
                  <th style={{ padding: "6px 4px" }}>Item</th>
                  <th style={{ padding: "6px 4px" }}>Warehouse</th>
                  <th style={{ padding: "6px 4px" }}>To</th>
                  <th style={{ padding: "6px 4px" }}>Qty</th>
                  <th style={{ padding: "6px 4px" }}>Reference</th>
                </tr>
              </thead>
              <tbody>
                {movements?.map((mv) => (
                  <tr key={mv.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{mv.type}</td>
                    <td style={{ padding: "6px 4px" }}>{itemName(mv.item)}</td>
                    <td style={{ padding: "6px 4px" }}>{warehouseName(mv.warehouse)}</td>
                    <td style={{ padding: "6px 4px" }}>{warehouseName(mv.to_warehouse)}</td>
                    <td style={{ padding: "6px 4px" }}>{mv.quantity}</td>
                    <td style={{ padding: "6px 4px", color: "#666" }}>{mv.reference || "—"}</td>
                  </tr>
                ))}
                {movements?.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "6px 4px", color: "#999" }}>
                      No movements yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form
                onSubmit={handleAddMovement}
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 8,
                  maxWidth: 840,
                }}
              >
                <select
                  value={movementForm.type}
                  onChange={(e) =>
                    setMovementForm({ ...movementForm, type: e.target.value as StockMovement["type"] })
                  }
                  style={{ padding: 8 }}
                >
                  <option value="in">In</option>
                  <option value="out">Out</option>
                  <option value="transfer">Transfer</option>
                  <option value="adjustment">Adjustment</option>
                </select>
                <select
                  required
                  value={movementForm.item}
                  onChange={(e) => setMovementForm({ ...movementForm, item: e.target.value })}
                  style={{ padding: 8 }}
                >
                  <option value="">Item…</option>
                  {items?.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={movementForm.warehouse}
                  onChange={(e) => setMovementForm({ ...movementForm, warehouse: e.target.value })}
                  style={{ padding: 8 }}
                >
                  <option value="">
                    {movementForm.type === "transfer" ? "From warehouse…" : "Warehouse…"}
                  </option>
                  {warehouses?.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                {movementForm.type === "transfer" && (
                  <select
                    required
                    value={movementForm.to_warehouse}
                    onChange={(e) => setMovementForm({ ...movementForm, to_warehouse: e.target.value })}
                    style={{ padding: 8 }}
                  >
                    <option value="">To warehouse…</option>
                    {warehouses?.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  placeholder={movementForm.type === "adjustment" ? "Quantity (± delta)" : "Quantity"}
                  type="number"
                  required
                  value={movementForm.quantity}
                  onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Reference (optional)"
                  value={movementForm.reference}
                  onChange={(e) => setMovementForm({ ...movementForm, reference: e.target.value })}
                  style={{ padding: 8 }}
                />
                <button
                  type="submit"
                  disabled={movementWorking || !movementForm.item || !movementForm.warehouse}
                  style={{ padding: "8px 16px", gridColumn: "1 / -1", justifySelf: "start" }}
                >
                  Record movement
                </button>
                {movementError && (
                  <p style={{ color: "crimson", gridColumn: "1 / -1", margin: 0 }}>{movementError}</p>
                )}
              </form>
            )}
          </section>
        </>
      )}
    </main>
  );
}
