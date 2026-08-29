"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type Item, type ProductVariant } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const EMPTY_FORM = { item: "", name: "", sku: "", barcode: "", price_cents: "" };

export default function ProductVariantsPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [variants, setVariants] = useState<ProductVariant[] | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadAll() {
    try {
      const [v, i] = await Promise.all([api.listProductVariants(), api.listItems()]);
      setVariants(v);
      setItems(i);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load product variants.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    try {
      await api.createProductVariant({
        item: Number(form.item),
        name: form.name,
        sku: form.sku,
        barcode: form.barcode,
        price_cents: form.price_cents ? Math.round(Number(form.price_cents) * 100) : null,
      });
      setForm(EMPTY_FORM);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save product variant.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteProductVariant(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to delete product variant.");
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
            <h1 className={shared.pageTitle}>Product Variants</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
            <p className={shared.hint} style={{ marginTop: 4 }}>
              A scannable SKU of an item — e.g. a size or color — with its own barcode and optional price override.
            </p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.section}>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Variant</th>
                  <th>SKU</th>
                  <th>Barcode</th>
                  <th>Price override</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {variants?.map((v) => (
                  <tr key={v.id}>
                    <td>{v.item_name}</td>
                    <td className={shared.tableMuted}>{v.name}</td>
                    <td className={shared.tableMuted}>{v.sku || "—"}</td>
                    <td className={shared.tableMuted}>{v.barcode || "—"}</td>
                    <td className={shared.tableMuted}>{v.price_cents != null ? formatCents(v.price_cents) : "—"}</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDelete(v.id)} disabled={working} />
                      </td>
                    )}
                  </tr>
                ))}
                {variants?.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      No product variants yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleCreate} className={shared.formRow} style={{ marginTop: 12 }}>
                <select
                  required
                  value={form.item}
                  onChange={(e) => setForm({ ...form, item: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Item…</option>
                  {items?.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Variant name (e.g. Large / Red)"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="SKU"
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 120 }}
                />
                <input
                  placeholder="Barcode"
                  value={form.barcode}
                  onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 140 }}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Price override"
                  value={form.price_cents}
                  onChange={(e) => setForm({ ...form, price_cents: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 130 }}
                />
                <button type="submit" disabled={working || !form.item || !form.name} className={`${shared.btn} ${shared.btnPrimary}`}>
                  Add variant
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
