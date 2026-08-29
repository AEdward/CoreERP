"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type BillOfMaterial, type ProductionOrder, type Warehouse } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const STATUS_LABELS: Record<ProductionOrder["status"], string> = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_BADGES: Record<ProductionOrder["status"], string> = {
  planned: shared.badgeInfo,
  in_progress: shared.badgeWarn,
  completed: shared.badgeSuccess,
  cancelled: shared.badgeDanger,
};

const EMPTY_FORM = { bom: "", warehouse: "", quantity: "" };

export default function ManufacturingPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [orders, setOrders] = useState<ProductionOrder[] | null>(null);
  const [boms, setBoms] = useState<BillOfMaterial[] | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [working, setWorking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [o, b, w] = await Promise.all([
        api.listProductionOrders(),
        api.listBOMs(),
        api.listWarehouses(),
      ]);
      setOrders(o);
      setBoms(b);
      setWarehouses(w);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load production orders.");
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
    setFormError(null);
    try {
      await api.createProductionOrder({
        bom: Number(form.bom),
        warehouse: Number(form.warehouse),
        quantity: Number(form.quantity),
      });
      setForm(EMPTY_FORM);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to create production order.");
    } finally {
      setWorking(false);
    }
  }

  async function handleStart(id: number) {
    setWorking(true);
    setFormError(null);
    try {
      await api.startProductionOrder(id);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to start order.");
    } finally {
      setWorking(false);
    }
  }

  async function handleCancel(id: number) {
    if (!confirm("Cancel this production order?")) return;
    setWorking(true);
    setFormError(null);
    try {
      await api.cancelProductionOrder(id);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Failed to cancel order.");
    } finally {
      setWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("manufacturing.manage") ?? false;

  return (
    <ModuleShell moduleKey="manufacturing" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Production Orders</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.section}>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Output</th>
                  <th>Warehouse</th>
                  <th>Quantity</th>
                  <th>Produced</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders?.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/dashboard/manufacturing/orders/${o.id}`}>{o.number}</Link>
                    </td>
                    <td>{o.output_item_name}</td>
                    <td className={shared.tableMuted}>{o.warehouse_name}</td>
                    <td className={shared.tableMuted}>{o.quantity}</td>
                    <td className={shared.tableMuted}>{o.produced_quantity}</td>
                    <td>
                      <span className={`${shared.badge} ${STATUS_BADGES[o.status]}`}>
                        {STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {canManage && o.status === "planned" && (
                        <button
                          type="button"
                          onClick={() => handleStart(o.id)}
                          disabled={working}
                          className={`${shared.btn} ${shared.btnSmall}`}
                          style={{ marginRight: 6 }}
                        >
                          Start
                        </button>
                      )}
                      {canManage && (o.status === "planned" || o.status === "in_progress") && (
                        <button
                          type="button"
                          onClick={() => handleCancel(o.id)}
                          disabled={working}
                          className={`${shared.btn} ${shared.btnSmall}`}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {orders?.length === 0 && (
                  <tr>
                    <td colSpan={7} className={shared.tableMuted}>
                      No production orders yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form onSubmit={handleCreate} className={shared.formRow} style={{ marginTop: 12 }}>
                <select
                  required
                  value={form.bom}
                  onChange={(e) => setForm({ ...form, bom: e.target.value })}
                  className={shared.select}
                >
                  <option value="">Bill of Materials…</option>
                  {boms?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.output_item_name})
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={form.warehouse}
                  onChange={(e) => setForm({ ...form, warehouse: e.target.value })}
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
                  type="number"
                  min={1}
                  placeholder="Quantity"
                  required
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 120 }}
                />
                <button
                  type="submit"
                  disabled={working || !form.bom || !form.warehouse || !form.quantity}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Create production order
                </button>
              </form>
            )}
            {formError && <p className={shared.errorText}>{formError}</p>}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
