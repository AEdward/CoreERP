"use client";

import type { Item } from "@/lib/api";

export interface LineItemRow {
  item: string;
  quantity: string;
  unitPrice: string;
  discountPercent?: string;
}

export const EMPTY_LINE: LineItemRow = { item: "", quantity: "1", unitPrice: "", discountPercent: "0" };

/** Shared by Purchase Orders, Quotations, and Sales Orders — all three
 * need the identical "pick an item, quantity, unit price, add/remove
 * line" interaction, just against a different backend field name for
 * the price (unit_cost_cents vs unit_price_cents), which the caller
 * handles when it builds the request body. `showDiscount` is Sales-only
 * (Quotation/SalesOrder lines have a discount_percent field, Purchase
 * Order lines don't) — omitted, the discount input just doesn't render,
 * and discountPercent stays unused for that caller's payload. */
export function LineItemsEditor({
  items,
  rows,
  onChange,
  priceLabel,
  showDiscount,
}: {
  items: Item[];
  rows: LineItemRow[];
  onChange: (rows: LineItemRow[]) => void;
  priceLabel: string;
  showDiscount?: boolean;
}) {
  function updateRow(index: number, patch: Partial<LineItemRow>) {
    const next = rows.slice();
    next[index] = { ...next[index], ...patch };
    onChange(next);
  }

  return (
    <div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
          <select
            value={row.item}
            onChange={(e) => updateRow(i, { item: e.target.value })}
            style={{ padding: 6, flex: 2 }}
          >
            <option value="">Item…</option>
            {items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Qty"
            value={row.quantity}
            onChange={(e) => updateRow(i, { quantity: e.target.value })}
            style={{ padding: 6, width: 80 }}
          />
          <input
            type="number"
            step="0.01"
            placeholder={priceLabel}
            value={row.unitPrice}
            onChange={(e) => updateRow(i, { unitPrice: e.target.value })}
            style={{ padding: 6, width: 120 }}
          />
          {showDiscount && (
            <input
              type="number"
              min="0"
              max="100"
              placeholder="Disc %"
              value={row.discountPercent ?? "0"}
              onChange={(e) => updateRow(i, { discountPercent: e.target.value })}
              style={{ padding: 6, width: 80 }}
            />
          )}
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
            disabled={rows.length === 1}
            style={{ padding: "4px 10px" }}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { ...EMPTY_LINE }])}
        style={{ padding: "4px 10px", marginTop: 4 }}
      >
        + Add line
      </button>
    </div>
  );
}
