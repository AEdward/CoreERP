"use client";

import { useEffect, useMemo, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import {
  api,
  ApiError,
  type CashierShift,
  type Customer,
  type Item,
  type ProductVariant,
  type RetailPromotion,
  type RetailSale,
  type Warehouse,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

type CartLine = {
  key: string;
  item: Item;
  variant: ProductVariant | null;
  quantity: number;
  unit_price_cents: number;
  discount_percent: number;
};

export default function RetailCheckoutPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [items, setItems] = useState<Item[] | null>(null);
  const [variants, setVariants] = useState<ProductVariant[] | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [promotions, setPromotions] = useState<RetailPromotion[] | null>(null);
  const [openShifts, setOpenShifts] = useState<CashierShift[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [shiftId, setShiftId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [promotionId, setPromotionId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<RetailSale["payment_method"]>("cash");
  const [barcode, setBarcode] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);

  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<RetailSale | null>(null);

  async function loadAll() {
    try {
      const [i, v, w, c, p, shifts] = await Promise.all([
        api.listItems(),
        api.listProductVariants(),
        api.listWarehouses(),
        api.listCustomers(),
        api.listRetailPromotions(),
        api.listCashierShifts({ status: "open" }),
      ]);
      setItems(i);
      setVariants(v);
      setWarehouses(w);
      setCustomers(c);
      setPromotions(p.filter((pr) => pr.is_active));
      setOpenShifts(shifts);
      if (shifts.length === 1) setShiftId(String(shifts[0].id));
      if (w.length === 1) setWarehouseId(String(w[0].id));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load checkout data.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  function addToCart(item: Item, variant: ProductVariant | null) {
    const unitPrice = variant?.price_cents ?? item.price_cents;
    setCart((prev) => {
      const key = `${item.id}-${variant?.id ?? "none"}`;
      const existing = prev.find((l) => l.key === key);
      if (existing) {
        return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { key, item, variant, quantity: 1, unit_price_cents: unitPrice, discount_percent: 0 }];
    });
  }

  function handleBarcodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    const code = barcode.trim();
    if (!code) return;
    const variant = variants?.find((v) => v.barcode === code);
    if (variant) {
      const item = items?.find((i) => i.id === variant.item);
      if (item) {
        addToCart(item, variant);
        setBarcode("");
        return;
      }
    }
    const item = items?.find((i) => i.barcode === code);
    if (item) {
      addToCart(item, null);
      setBarcode("");
      return;
    }
    setActionError(`No item or variant found for barcode "${code}".`);
  }

  function updateLine(key: string, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  const cartSubtotal = useMemo(
    () =>
      cart.reduce((sum, l) => {
        const gross = l.quantity * l.unit_price_cents;
        return sum + (gross - Math.floor((gross * l.discount_percent) / 100));
      }, 0),
    [cart]
  );

  async function handleCompleteSale() {
    if (!shiftId || !warehouseId || cart.length === 0) return;
    const shift = openShifts?.find((s) => String(s.id) === shiftId);
    if (!shift) return;
    setWorking(true);
    setActionError(null);
    try {
      const sale = await api.checkoutRetailSale({
        register: shift.register,
        shift: shift.id,
        warehouse: Number(warehouseId),
        customer: customerId ? Number(customerId) : null,
        promotion: promotionId ? Number(promotionId) : null,
        payment_method: paymentMethod,
        lines: cart.map((l) => ({
          item: l.item.id,
          variant: l.variant?.id ?? null,
          quantity: l.quantity,
          unit_price_cents: l.unit_price_cents,
          discount_percent: l.discount_percent,
        })),
      });
      setCompletedSale(sale);
      setCart([]);
      setPromotionId("");
      setCustomerId("");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to complete sale.");
    } finally {
      setWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("retail.manage") ?? false;

  return (
    <ModuleShell moduleKey="retail" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Checkout</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}
        {actionError && <p className={shared.errorText}>{actionError}</p>}

        {!canManage ? (
          <p className={shared.emptyState}>You don&apos;t have permission to ring up sales.</p>
        ) : openShifts?.length === 0 ? (
          <p className={shared.emptyState}>
            No open cashier shift. Open one on the{" "}
            <a href="/dashboard/retail/registers">Registers & Shifts</a> page first.
          </p>
        ) : (
          <>
            {completedSale && (
              <div className={shared.section}>
                <div className={shared.card} style={{ borderLeft: "4px solid var(--status-success, #16a34a)" }}>
                  <strong>{completedSale.number}</strong> completed — total {formatCents(completedSale.total_cents)}
                  {completedSale.discount_cents > 0 && ` (discount ${formatCents(completedSale.discount_cents)})`}
                  {completedSale.tax_cents > 0 && ` (tax ${formatCents(completedSale.tax_cents)})`}
                </div>
              </div>
            )}

            <div className={shared.section}>
              <div className={shared.card}>
                <div className={shared.formRow}>
                  <select value={shiftId} onChange={(e) => setShiftId(e.target.value)} className={shared.select}>
                    <option value="">Shift…</option>
                    {openShifts?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.register_name} — {s.cashier_name}
                      </option>
                    ))}
                  </select>
                  <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className={shared.select}>
                    <option value="">Warehouse…</option>
                    {warehouses?.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                  <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={shared.select}>
                    <option value="">Walk-in customer</option>
                    {customers?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select value={promotionId} onChange={(e) => setPromotionId(e.target.value)} className={shared.select}>
                    <option value="">No promotion</option>
                    {promotions?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as RetailSale["payment_method"])}
                    className={shared.select}
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="mobile_money">Mobile money</option>
                    <option value="gift_card">Gift card</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={shared.section}>
              <h2 className={shared.sectionTitle}>Scan or add items</h2>
              <div className={shared.card}>
                <form onSubmit={handleBarcodeSubmit} className={shared.formRow}>
                  <input
                    autoFocus
                    placeholder="Scan barcode and press Enter"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className={shared.input}
                  />
                  <button type="submit" className={`${shared.btn} ${shared.btnPrimary}`}>
                    Add
                  </button>
                </form>
                <div className={shared.formRow} style={{ marginTop: 12 }}>
                  <select
                    value=""
                    onChange={(e) => {
                      const item = items?.find((i) => String(i.id) === e.target.value);
                      if (item) addToCart(item, null);
                    }}
                    className={shared.select}
                  >
                    <option value="">Add item by name…</option>
                    {items?.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value=""
                    onChange={(e) => {
                      const variant = variants?.find((v) => String(v.id) === e.target.value);
                      const item = items?.find((i) => i.id === variant?.item);
                      if (variant && item) addToCart(item, variant);
                    }}
                    className={shared.select}
                  >
                    <option value="">Add variant by name…</option>
                    {variants?.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.item_name} — {v.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className={shared.section}>
              <h2 className={shared.sectionTitle}>Cart</h2>
              <div className={shared.card}>
                <table className={shared.table}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Unit price</th>
                      <th>Discount %</th>
                      <th>Line total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((l) => {
                      const gross = l.quantity * l.unit_price_cents;
                      const lineTotal = gross - Math.floor((gross * l.discount_percent) / 100);
                      return (
                        <tr key={l.key}>
                          <td>
                            {l.item.name}
                            {l.variant ? ` — ${l.variant.name}` : ""}
                          </td>
                          <td>
                            <input
                              type="number"
                              min={1}
                              value={l.quantity}
                              onChange={(e) => updateLine(l.key, { quantity: Math.max(1, Number(e.target.value)) })}
                              className={shared.input}
                              style={{ maxWidth: 70 }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={(l.unit_price_cents / 100).toFixed(2)}
                              onChange={(e) =>
                                updateLine(l.key, { unit_price_cents: Math.round(Number(e.target.value) * 100) })
                              }
                              className={shared.input}
                              style={{ maxWidth: 90 }}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={l.discount_percent}
                              onChange={(e) =>
                                updateLine(l.key, { discount_percent: Math.min(100, Math.max(0, Number(e.target.value))) })
                              }
                              className={shared.input}
                              style={{ maxWidth: 70 }}
                            />
                          </td>
                          <td className={shared.tableMuted}>{formatCents(lineTotal)}</td>
                          <td>
                            <button
                              type="button"
                              onClick={() => removeLine(l.key)}
                              className={`${shared.btn} ${shared.btnSmall}`}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {cart.length === 0 && (
                      <tr>
                        <td colSpan={6} className={shared.tableMuted}>
                          Cart is empty.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p className={shared.hint}>
                    Estimated subtotal {formatCents(cartSubtotal)} — promotion discount and tax are computed at
                    checkout.
                  </p>
                  <button
                    type="button"
                    onClick={handleCompleteSale}
                    disabled={working || !shiftId || !warehouseId || cart.length === 0}
                    className={`${shared.btn} ${shared.btnPrimary}`}
                  >
                    Complete sale
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </ModuleShell>
  );
}
