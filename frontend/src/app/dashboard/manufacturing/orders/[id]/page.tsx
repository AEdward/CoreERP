"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ModuleShell } from "@/components/ModuleShell";
import {
  api,
  ApiError,
  type Item,
  type ManufacturingWorkOrder,
  type MaterialConsumption,
  type ProductionOrder,
  type QualityCheck,
  type ScrapEntry,
} from "@/lib/api";
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

const WORK_ORDER_STATUS_LABELS: Record<ManufacturingWorkOrder["status"], string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
};

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function ProductionOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);
  const { me, activeMembership, error: sessionError } = useSession();

  const [order, setOrder] = useState<ProductionOrder | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [consumptions, setConsumptions] = useState<MaterialConsumption[] | null>(null);
  const [scrapEntries, setScrapEntries] = useState<ScrapEntry[] | null>(null);
  const [qualityChecks, setQualityChecks] = useState<QualityCheck[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [consumeForm, setConsumeForm] = useState({ item: "", quantity: "" });
  const [produceQuantity, setProduceQuantity] = useState("");
  const [scrapForm, setScrapForm] = useState({ item: "", quantity: "", reason: "" });
  const [qualityForm, setQualityForm] = useState<{ result: QualityCheck["result"]; notes: string }>({
    result: "pass",
    notes: "",
  });

  async function loadAll() {
    try {
      const [o, i, c, s, q] = await Promise.all([
        api.getProductionOrder(orderId),
        api.listItems(),
        api.listMaterialConsumptions(orderId),
        api.listScrapEntries(orderId),
        api.listQualityChecks(orderId),
      ]);
      setOrder(o);
      setItems(i);
      setConsumptions(c);
      setScrapEntries(s);
      setQualityChecks(q);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load production order.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id, orderId]);

  async function handleStart() {
    setWorking(true);
    setActionError(null);
    try {
      await api.startProductionOrder(orderId);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to start order.");
    } finally {
      setWorking(false);
    }
  }

  async function handleComplete() {
    setWorking(true);
    setActionError(null);
    try {
      await api.completeProductionOrder(orderId);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to complete order.");
    } finally {
      setWorking(false);
    }
  }

  async function handleCancel() {
    if (!confirm("Cancel this production order?")) return;
    setWorking(true);
    setActionError(null);
    try {
      await api.cancelProductionOrder(orderId);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to cancel order.");
    } finally {
      setWorking(false);
    }
  }

  async function handleConsume(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setActionError(null);
    try {
      await api.consumeMaterial(orderId, { item: Number(consumeForm.item), quantity: Number(consumeForm.quantity) });
      setConsumeForm({ item: "", quantity: "" });
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to consume material.");
    } finally {
      setWorking(false);
    }
  }

  async function handleProduce(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setActionError(null);
    try {
      await api.produceOutput(orderId, { quantity: Number(produceQuantity) });
      setProduceQuantity("");
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to record output.");
    } finally {
      setWorking(false);
    }
  }

  async function handleScrap(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setActionError(null);
    try {
      await api.createScrapEntry({
        production_order: orderId,
        item: Number(scrapForm.item),
        quantity: Number(scrapForm.quantity),
        reason: scrapForm.reason,
      });
      setScrapForm({ item: "", quantity: "", reason: "" });
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to log scrap.");
    } finally {
      setWorking(false);
    }
  }

  async function handleQualityCheck(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setActionError(null);
    try {
      await api.createQualityCheck({ production_order: orderId, result: qualityForm.result, notes: qualityForm.notes });
      setQualityForm({ result: "pass", notes: "" });
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to log quality check.");
    } finally {
      setWorking(false);
    }
  }

  async function handleStartWorkOrder(id: number) {
    setWorking(true);
    setActionError(null);
    try {
      await api.startManufacturingWorkOrder(id);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to start work order.");
    } finally {
      setWorking(false);
    }
  }

  async function handleCompleteWorkOrder(id: number) {
    const actualHours = prompt("Actual hours spent on this operation?");
    if (actualHours === null) return;
    setWorking(true);
    setActionError(null);
    try {
      await api.completeManufacturingWorkOrder(id, actualHours);
      await loadAll();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to complete work order.");
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
            <h1 className={shared.pageTitle}>{order?.number ?? "Production Order"}</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
            <p className={shared.hint} style={{ marginTop: 4 }}>
              <a href="/dashboard/manufacturing">&larr; Back to production orders</a>
            </p>
          </div>
          {order && (
            <div className={shared.pageActions}>
              <span className={`${shared.badge} ${STATUS_BADGES[order.status]}`}>
                {STATUS_LABELS[order.status]}
              </span>
              {canManage && order.status === "planned" && (
                <button type="button" onClick={handleStart} disabled={working} className={`${shared.btn} ${shared.btnPrimary}`}>
                  Start
                </button>
              )}
              {canManage && order.status === "in_progress" && (
                <button type="button" onClick={handleComplete} disabled={working} className={`${shared.btn} ${shared.btnPrimary}`}>
                  Complete order
                </button>
              )}
              {canManage && (order.status === "planned" || order.status === "in_progress") && (
                <button type="button" onClick={handleCancel} disabled={working} className={`${shared.btn} ${shared.btnDanger}`}>
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}
        {actionError && <p className={shared.errorText}>{actionError}</p>}

        {order && (
          <>
            <div className={shared.section}>
              <div className={shared.card}>
                <div className={shared.formGrid}>
                  <div>
                    <div className={shared.label}>Output</div>
                    <div>{order.bom_name} — {order.output_item_name}</div>
                  </div>
                  <div>
                    <div className={shared.label}>Warehouse</div>
                    <div>{order.warehouse_name}</div>
                  </div>
                  <div>
                    <div className={shared.label}>Quantity</div>
                    <div>{order.produced_quantity} / {order.quantity} produced</div>
                  </div>
                  <div>
                    <div className={shared.label}>Material cost</div>
                    <div>{formatCents(order.total_material_cost_cents)}</div>
                  </div>
                  <div>
                    <div className={shared.label}>Labor cost</div>
                    <div>{formatCents(order.total_labor_cost_cents)}</div>
                  </div>
                  <div>
                    <div className={shared.label}>Scrap cost</div>
                    <div>{formatCents(order.total_scrap_cost_cents)}</div>
                  </div>
                  <div>
                    <div className={shared.label}>Total cost</div>
                    <div>{formatCents(order.total_cost_cents)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className={shared.section}>
              <h2 className={shared.sectionTitle}>Work orders</h2>
              <div className={shared.card}>
                <table className={shared.table}>
                  <thead>
                    <tr>
                      <th>Operation</th>
                      <th>Work center</th>
                      <th>Status</th>
                      <th>Planned hrs</th>
                      <th>Actual hrs</th>
                      {canManage && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {order.work_orders.map((wo) => (
                      <tr key={wo.id}>
                        <td>{wo.operation_name}</td>
                        <td className={shared.tableMuted}>{wo.work_center_name}</td>
                        <td className={shared.tableMuted}>{WORK_ORDER_STATUS_LABELS[wo.status]}</td>
                        <td className={shared.tableMuted}>{wo.planned_hours}</td>
                        <td className={shared.tableMuted}>{wo.actual_hours ?? "—"}</td>
                        {canManage && (
                          <td style={{ textAlign: "right" }}>
                            {wo.status === "pending" && (
                              <button
                                type="button"
                                onClick={() => handleStartWorkOrder(wo.id)}
                                disabled={working}
                                className={`${shared.btn} ${shared.btnSmall}`}
                                style={{ marginRight: 6 }}
                              >
                                Start
                              </button>
                            )}
                            {wo.status === "in_progress" && (
                              <button
                                type="button"
                                onClick={() => handleCompleteWorkOrder(wo.id)}
                                disabled={working}
                                className={`${shared.btn} ${shared.btnSmall}`}
                              >
                                Complete
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                    {order.work_orders.length === 0 && (
                      <tr>
                        <td colSpan={6} className={shared.tableMuted}>
                          No operations on this order&apos;s BOM.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={shared.section}>
              <h2 className={shared.sectionTitle}>Materials consumed</h2>
              <div className={shared.card}>
                <table className={shared.table}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Quantity</th>
                      <th>Unit cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumptions?.map((c) => (
                      <tr key={c.id}>
                        <td>{c.item_name}</td>
                        <td className={shared.tableMuted}>{c.quantity}</td>
                        <td className={shared.tableMuted}>{formatCents(c.unit_cost_cents)}</td>
                      </tr>
                    ))}
                    {consumptions?.length === 0 && (
                      <tr>
                        <td colSpan={3} className={shared.tableMuted}>
                          Nothing consumed yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {canManage && order.status === "in_progress" && (
                  <form onSubmit={handleConsume} className={shared.formRow} style={{ marginTop: 12 }}>
                    <select
                      required
                      value={consumeForm.item}
                      onChange={(e) => setConsumeForm({ ...consumeForm, item: e.target.value })}
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
                      type="number"
                      min={1}
                      placeholder="Quantity"
                      required
                      value={consumeForm.quantity}
                      onChange={(e) => setConsumeForm({ ...consumeForm, quantity: e.target.value })}
                      className={shared.input}
                      style={{ maxWidth: 120 }}
                    />
                    <button
                      type="submit"
                      disabled={working || !consumeForm.item || !consumeForm.quantity}
                      className={`${shared.btn} ${shared.btnPrimary}`}
                    >
                      Consume
                    </button>
                  </form>
                )}
              </div>
            </div>

            {canManage && order.status === "in_progress" && (
              <div className={shared.section}>
                <h2 className={shared.sectionTitle}>Record output</h2>
                <div className={shared.card}>
                  <form onSubmit={handleProduce} className={shared.formRow}>
                    <input
                      type="number"
                      min={1}
                      placeholder="Quantity produced"
                      required
                      value={produceQuantity}
                      onChange={(e) => setProduceQuantity(e.target.value)}
                      className={shared.input}
                      style={{ maxWidth: 160 }}
                    />
                    <button
                      type="submit"
                      disabled={working || !produceQuantity}
                      className={`${shared.btn} ${shared.btnPrimary}`}
                    >
                      Receive into stock
                    </button>
                  </form>
                  <p className={shared.hint} style={{ marginTop: 8 }}>
                    Also receives any BOM byproducts, scaled to the same quantity.
                  </p>
                </div>
              </div>
            )}

            <div className={shared.section}>
              <h2 className={shared.sectionTitle}>Scrap</h2>
              <div className={shared.card}>
                <table className={shared.table}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Quantity</th>
                      <th>Cost</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scrapEntries?.map((s) => (
                      <tr key={s.id}>
                        <td>{s.item_name}</td>
                        <td className={shared.tableMuted}>{s.quantity}</td>
                        <td className={shared.tableMuted}>{formatCents(s.quantity * s.unit_cost_cents)}</td>
                        <td className={shared.tableMuted}>{s.reason || "—"}</td>
                      </tr>
                    ))}
                    {scrapEntries?.length === 0 && (
                      <tr>
                        <td colSpan={4} className={shared.tableMuted}>
                          No scrap logged.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {canManage && (
                  <form onSubmit={handleScrap} className={shared.formRow} style={{ marginTop: 12 }}>
                    <select
                      required
                      value={scrapForm.item}
                      onChange={(e) => setScrapForm({ ...scrapForm, item: e.target.value })}
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
                      type="number"
                      min={1}
                      placeholder="Quantity"
                      required
                      value={scrapForm.quantity}
                      onChange={(e) => setScrapForm({ ...scrapForm, quantity: e.target.value })}
                      className={shared.input}
                      style={{ maxWidth: 100 }}
                    />
                    <input
                      placeholder="Reason"
                      value={scrapForm.reason}
                      onChange={(e) => setScrapForm({ ...scrapForm, reason: e.target.value })}
                      className={shared.input}
                    />
                    <button
                      type="submit"
                      disabled={working || !scrapForm.item || !scrapForm.quantity}
                      className={`${shared.btn} ${shared.btnPrimary}`}
                    >
                      Log scrap
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div className={shared.section}>
              <h2 className={shared.sectionTitle}>Quality checks</h2>
              <div className={shared.card}>
                <table className={shared.table}>
                  <thead>
                    <tr>
                      <th>Result</th>
                      <th>Checked by</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {qualityChecks?.map((q) => (
                      <tr key={q.id}>
                        <td>
                          <span
                            className={`${shared.badge} ${
                              q.result === "pass" ? shared.badgeSuccess : q.result === "fail" ? shared.badgeDanger : shared.badgeWarn
                            }`}
                          >
                            {q.result}
                          </span>
                        </td>
                        <td className={shared.tableMuted}>{q.checked_by_name || "—"}</td>
                        <td className={shared.tableMuted}>{q.notes || "—"}</td>
                      </tr>
                    ))}
                    {qualityChecks?.length === 0 && (
                      <tr>
                        <td colSpan={3} className={shared.tableMuted}>
                          No quality checks logged.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {canManage && (
                  <form onSubmit={handleQualityCheck} className={shared.formRow} style={{ marginTop: 12 }}>
                    <select
                      value={qualityForm.result}
                      onChange={(e) => setQualityForm({ ...qualityForm, result: e.target.value as QualityCheck["result"] })}
                      className={shared.select}
                    >
                      <option value="pass">Pass</option>
                      <option value="fail">Fail</option>
                      <option value="rework">Rework</option>
                    </select>
                    <input
                      placeholder="Notes"
                      value={qualityForm.notes}
                      onChange={(e) => setQualityForm({ ...qualityForm, notes: e.target.value })}
                      className={shared.input}
                    />
                    <button type="submit" disabled={working} className={`${shared.btn} ${shared.btnPrimary}`}>
                      Log check
                    </button>
                  </form>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </ModuleShell>
  );
}
