"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import {
  api,
  ApiError,
  type Branch,
  type Item,
  type ReorderSuggestion,
  type Stock,
  type StockMovement,
  type StorageLocation,
  type TaxRate,
  type Warehouse,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

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
  const [storageLocations, setStorageLocations] = useState<StorageLocation[] | null>(null);
  const [reorderSuggestions, setReorderSuggestions] = useState<ReorderSuggestion[] | null>(null);
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

  const [locationWarehouse, setLocationWarehouse] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationCode, setLocationCode] = useState("");
  const [locationWorking, setLocationWorking] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [prWorking, setPrWorking] = useState(false);
  const [prError, setPrError] = useState<string | null>(null);
  const [prSuccess, setPrSuccess] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [i, w, br, s, m, tr, sl, rs] = await Promise.all([
        api.listItems(),
        api.listWarehouses(),
        api.listBranches(),
        api.listStock(),
        api.listStockMovements(),
        api.listTaxRates(),
        api.listStorageLocations(),
        api.reorderSuggestions(),
      ]);
      setItems(i);
      setWarehouses(w);
      setBranches(br);
      setStock(s);
      setMovements(m);
      setTaxRates(tr);
      setStorageLocations(sl);
      setReorderSuggestions(rs);
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

  async function handleAddLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!locationWarehouse) return;
    setLocationWorking(true);
    setLocationError(null);
    try {
      await api.createStorageLocation({
        warehouse: Number(locationWarehouse),
        name: locationName,
        code: locationCode,
      });
      setLocationName("");
      setLocationCode("");
      await loadAll();
    } catch (err) {
      setLocationError(err instanceof ApiError ? err.message : "Failed to add storage location.");
    } finally {
      setLocationWorking(false);
    }
  }

  async function handleDeleteLocation(id: number) {
    try {
      await api.deleteStorageLocation(id);
      await loadAll();
    } catch (err) {
      setLocationError(err instanceof ApiError ? err.message : "Failed to delete storage location.");
    }
  }

  function toggleSuggestion(itemId: number) {
    const next = new Set(selectedSuggestions);
    if (next.has(itemId)) {
      next.delete(itemId);
    } else {
      next.add(itemId);
    }
    setSelectedSuggestions(next);
  }

  async function handleCreatePurchaseRequestFromSuggestions() {
    if (!reorderSuggestions) return;
    const chosen = reorderSuggestions.filter((s) => selectedSuggestions.has(s.item_id));
    if (chosen.length === 0) return;
    setPrWorking(true);
    setPrError(null);
    setPrSuccess(null);
    try {
      await api.createPurchaseRequest({
        justification: "Auto-suggested from low stock levels",
        lines: chosen.map((s) => ({
          item: s.item_id,
          quantity: s.suggested_quantity,
          estimated_unit_cost_cents: 0,
        })),
      });
      setSelectedSuggestions(new Set());
      setPrSuccess("Purchase request created — see Procurement.");
    } catch (err) {
      setPrError(err instanceof ApiError ? err.message : "Failed to create purchase request.");
    } finally {
      setPrWorking(false);
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

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

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
    <ModuleShell moduleKey="inventory" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Inventory & Catalog</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
          <div className={shared.pageActions}>
            <a href="/dashboard/inventory/stock-counts" className={shared.btn}>
              Stock counts &rarr;
            </a>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        {/* Items */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Items</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Cost</th>
                  <th>Tax</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {items?.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.type}</td>
                    <td>{item.category || "—"}</td>
                    <td>{formatCents(item.price_cents)}</td>
                    <td>{formatCents(item.cost_cents)}</td>
                    <td>{taxRateLabel(item.tax_rate)}</td>
                    <td>{item.status}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
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
                    <td colSpan={8} className={shared.tableMuted}>
                      No items yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form onSubmit={handleAddItem} className={shared.formGrid} style={{ marginTop: 16 }}>
                <select
                  value={itemForm.type}
                  onChange={(e) => setItemForm({ ...itemForm, type: e.target.value as Item["type"] })}
                  className={shared.select}
                >
                  <option value="product">Product</option>
                  <option value="service">Service</option>
                </select>
                <input
                  placeholder="Name"
                  required
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Category"
                  value={itemForm.category}
                  onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Price"
                  type="number"
                  step="0.01"
                  value={itemForm.price}
                  onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Cost"
                  type="number"
                  step="0.01"
                  value={itemForm.cost}
                  onChange={(e) => setItemForm({ ...itemForm, cost: e.target.value })}
                  className={shared.input}
                />
                <select
                  value={itemForm.tax_rate}
                  onChange={(e) => setItemForm({ ...itemForm, tax_rate: e.target.value })}
                  className={shared.select}
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
                  <button
                    type="submit"
                    disabled={itemWorking || !itemForm.name}
                    className={`${shared.btn} ${shared.btnPrimary}`}
                  >
                    {editingItemId ? "Save changes" : "Add item"}
                  </button>
                  {editingItemId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItemId(null);
                        setItemForm(EMPTY_ITEM_FORM);
                      }}
                      className={shared.btn}
                    >
                      Cancel
                    </button>
                  )}
                </div>
                {itemError && (
                  <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                    {itemError}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Warehouses */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Warehouses</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <tbody>
                {warehouses?.map((w) => (
                  <tr key={w.id}>
                    <td>{w.name}</td>
                    <td className={shared.tableMuted}>{w.location || "—"}</td>
                    <td className={shared.tableMuted}>{branchName(w.branch)}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
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
                    <td colSpan={3} className={shared.tableMuted}>
                      No warehouses yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddWarehouse} className={shared.formRow} style={{ marginTop: 16 }}>
                <input
                  placeholder="Warehouse name"
                  required
                  value={warehouseForm.name}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
                  className={shared.input}
                  style={{ flex: 1, maxWidth: 240 }}
                />
                <input
                  placeholder="Location"
                  value={warehouseForm.location}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, location: e.target.value })}
                  className={shared.input}
                  style={{ flex: 1, maxWidth: 240 }}
                />
                <select
                  value={warehouseForm.branch}
                  onChange={(e) => setWarehouseForm({ ...warehouseForm, branch: e.target.value })}
                  className={shared.select}
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
                  className={`${shared.btn} ${shared.btnPrimary}`}
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
                    className={shared.btn}
                  >
                    Cancel
                  </button>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Storage locations */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Storage locations</h2>
          <div className={shared.card}>
            <p className={shared.hint} style={{ maxWidth: 600, marginBottom: 12 }}>
              Sub-warehouse bins/aisles — purely descriptive; stock movements can optionally note
              which one they went to/from, but quantities are still tracked per-warehouse, not
              per-location.
            </p>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Warehouse</th>
                  <th>Name</th>
                  <th>Code</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {storageLocations?.map((loc) => (
                  <tr key={loc.id}>
                    <td>{warehouseName(loc.warehouse)}</td>
                    <td>{loc.name}</td>
                    <td>{loc.code}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDeleteLocation(loc.id)} disabled={locationWorking} />
                      </td>
                    )}
                  </tr>
                ))}
                {storageLocations?.length === 0 && (
                  <tr>
                    <td colSpan={4} className={shared.tableMuted}>
                      No storage locations yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleAddLocation} className={shared.formRow} style={{ marginTop: 16 }}>
                <select
                  required
                  value={locationWarehouse}
                  onChange={(e) => setLocationWarehouse(e.target.value)}
                  className={shared.select}
                >
                  <option value="">Warehouse…</option>
                  {warehouses?.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Name (e.g. Aisle 3)"
                  required
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  className={shared.input}
                />
                <input
                  placeholder="Code (optional)"
                  value={locationCode}
                  onChange={(e) => setLocationCode(e.target.value)}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={locationWorking || !locationWarehouse || !locationName}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Add location
                </button>
              </form>
            )}
            {locationError && <p className={shared.errorText}>{locationError}</p>}
          </div>
        </div>

        {/* Stock levels */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Stock levels</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Warehouse</th>
                  <th>Quantity</th>
                  <th>Minimum</th>
                </tr>
              </thead>
              <tbody>
                {stock?.map((s) => (
                  <tr key={s.id}>
                    <td>{s.item_name}</td>
                    <td>{s.warehouse_name}</td>
                    <td style={{ color: s.quantity <= s.minimum_stock ? "var(--status-danger)" : "inherit" }}>
                      {s.quantity}
                    </td>
                    <td>{s.minimum_stock}</td>
                  </tr>
                ))}
                {stock?.length === 0 && (
                  <tr>
                    <td colSpan={4} className={shared.tableMuted}>
                      No stock recorded yet — add a movement below.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Stock movements */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Stock movements</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Item</th>
                  <th>Warehouse</th>
                  <th>To</th>
                  <th>Qty</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {movements?.map((mv) => (
                  <tr key={mv.id}>
                    <td>{mv.type}</td>
                    <td>{itemName(mv.item)}</td>
                    <td>{warehouseName(mv.warehouse)}</td>
                    <td>{warehouseName(mv.to_warehouse)}</td>
                    <td>{mv.quantity}</td>
                    <td className={shared.tableMuted}>{mv.reference || "—"}</td>
                  </tr>
                ))}
                {movements?.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      No movements yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form onSubmit={handleAddMovement} className={shared.formGrid} style={{ marginTop: 16 }}>
                <select
                  value={movementForm.type}
                  onChange={(e) =>
                    setMovementForm({ ...movementForm, type: e.target.value as StockMovement["type"] })
                  }
                  className={shared.select}
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
                  className={shared.select}
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
                  className={shared.select}
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
                    className={shared.select}
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
                  className={shared.input}
                />
                <input
                  placeholder="Reference (optional)"
                  value={movementForm.reference}
                  onChange={(e) => setMovementForm({ ...movementForm, reference: e.target.value })}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={movementWorking || !movementForm.item || !movementForm.warehouse}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                  style={{ gridColumn: "1 / -1", justifySelf: "start" }}
                >
                  Record movement
                </button>
                {movementError && (
                  <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                    {movementError}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>

        {/* Reorder suggestions */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Reorder suggestions</h2>
          <div className={shared.card}>
            <p className={shared.hint} style={{ maxWidth: 600, marginBottom: 12 }}>
              Items at or below their minimum stock level. A simple &quot;top back up to minimum&quot;
              suggestion, not a real reorder-point/EOQ system. Select some and create a purchase
              request — it starts with no supplier, same as any other purchase request.
            </p>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th></th>
                  <th>Item</th>
                  <th>Warehouse</th>
                  <th>Quantity</th>
                  <th>Minimum</th>
                  <th>Suggested reorder</th>
                </tr>
              </thead>
              <tbody>
                {reorderSuggestions?.map((s) => (
                  <tr key={`${s.item_id}-${s.warehouse_id}`}>
                    <td>
                      {canManage && (
                        <input
                          type="checkbox"
                          checked={selectedSuggestions.has(s.item_id)}
                          onChange={() => toggleSuggestion(s.item_id)}
                        />
                      )}
                    </td>
                    <td>{s.item_name}</td>
                    <td>{s.warehouse_name}</td>
                    <td>{s.quantity}</td>
                    <td>{s.minimum_stock}</td>
                    <td>{s.suggested_quantity}</td>
                  </tr>
                ))}
                {reorderSuggestions?.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      Nothing needs reordering right now.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && reorderSuggestions && reorderSuggestions.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  disabled={prWorking || selectedSuggestions.size === 0}
                  onClick={handleCreatePurchaseRequestFromSuggestions}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Create purchase request from selected
                </button>
              </div>
            )}
            {prError && <p className={shared.errorText}>{prError}</p>}
            {prSuccess && <p style={{ color: "var(--status-success)", fontSize: 13 }}>{prSuccess}</p>}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
