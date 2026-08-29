"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type PropertySale } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const STATUS_BADGES: Record<PropertySale["status"], string> = {
  pending: shared.badgeWarn,
  completed: shared.badgeSuccess,
  cancelled: shared.badgeDanger,
};

export default function PropertySaleDetailPage() {
  const params = useParams<{ id: string }>();
  const saleId = Number(params.id);
  const { me, activeMembership, error: sessionError } = useSession();

  const [sale, setSale] = useState<PropertySale | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [installmentCount, setInstallmentCount] = useState("12");
  const [installmentStart, setInstallmentStart] = useState("");

  async function load() {
    try {
      setSale(await api.getPropertySale(saleId));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load sale.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id, saleId]);

  async function handleGenerateInstallments(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    setActionError(null);
    try {
      await api.generateInstallments(saleId, { count: Number(installmentCount), start_date: installmentStart });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to generate installments.");
    } finally {
      setWorking(false);
    }
  }

  async function handleComplete() {
    setWorking(true);
    setActionError(null);
    try {
      await api.completePropertySale(saleId);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to complete sale.");
    } finally {
      setWorking(false);
    }
  }

  async function handleCancel() {
    if (!confirm("Cancel this sale?")) return;
    setWorking(true);
    setActionError(null);
    try {
      await api.cancelPropertySale(saleId);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to cancel sale.");
    } finally {
      setWorking(false);
    }
  }

  async function handleRecordInstallment(id: number) {
    setWorking(true);
    setActionError(null);
    try {
      await api.recordInstallmentPayment(id);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to record payment.");
    } finally {
      setWorking(false);
    }
  }

  async function handleMarkCommissionPaid(id: number) {
    setWorking(true);
    setActionError(null);
    try {
      await api.markCommissionPaid(id);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to mark commission paid.");
    } finally {
      setWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("realestate.manage") ?? false;

  return (
    <ModuleShell moduleKey="realestate" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>{sale?.number ?? "Property Sale"}</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
            <p className={shared.hint} style={{ marginTop: 4 }}>
              <Link href="/dashboard/realestate/sales">&larr; Back to sales</Link>
            </p>
          </div>
          {sale && (
            <div className={shared.pageActions}>
              <span className={`${shared.badge} ${STATUS_BADGES[sale.status]}`}>{sale.status}</span>
              {canManage && sale.status === "pending" && (
                <button type="button" onClick={handleComplete} disabled={working} className={`${shared.btn} ${shared.btnPrimary}`}>
                  Complete sale
                </button>
              )}
              {canManage && sale.status === "pending" && (
                <button type="button" onClick={handleCancel} disabled={working} className={`${shared.btn} ${shared.btnDanger}`}>
                  Cancel
                </button>
              )}
            </div>
          )}
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}
        {actionError && <p className={shared.errorText}>{actionError}</p>}

        {sale && (
          <>
            <div className={shared.section}>
              <div className={shared.card}>
                <div className={shared.formGrid}>
                  <div>
                    <div className={shared.label}>Unit</div>
                    <div>{sale.unit_label}</div>
                  </div>
                  <div>
                    <div className={shared.label}>Buyer</div>
                    <div>{sale.buyer_name}</div>
                  </div>
                  <div>
                    <div className={shared.label}>Agent</div>
                    <div>{sale.agent_name || "—"}</div>
                  </div>
                  <div>
                    <div className={shared.label}>Sale price</div>
                    <div>{formatCents(sale.sale_price_cents)}</div>
                  </div>
                  <div>
                    <div className={shared.label}>Down payment</div>
                    <div>{formatCents(sale.down_payment_cents)}</div>
                  </div>
                  <div>
                    <div className={shared.label}>Sale date</div>
                    <div>{sale.sale_date}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className={shared.section}>
              <h2 className={shared.sectionTitle}>Payment installments</h2>
              <div className={shared.card}>
                <table className={shared.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Due</th>
                      <th>Amount</th>
                      <th>Status</th>
                      {canManage && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sale.installments.map((i) => (
                      <tr key={i.id}>
                        <td>{i.installment_number}</td>
                        <td className={shared.tableMuted}>{i.due_date}</td>
                        <td className={shared.tableMuted}>{formatCents(i.amount_cents)}</td>
                        <td>
                          <span className={`${shared.badge} ${i.status === "paid" ? shared.badgeSuccess : shared.badgeWarn}`}>
                            {i.status}
                          </span>
                        </td>
                        {canManage && (
                          <td style={{ textAlign: "right" }}>
                            {i.status !== "paid" && (
                              <button
                                type="button"
                                onClick={() => handleRecordInstallment(i.id)}
                                disabled={working}
                                className={`${shared.btn} ${shared.btnSmall}`}
                              >
                                Record payment
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                    {sale.installments.length === 0 && (
                      <tr>
                        <td colSpan={5} className={shared.tableMuted}>
                          No payment plan yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {canManage && sale.installments.length === 0 && (
                  <form onSubmit={handleGenerateInstallments} className={shared.formRow} style={{ marginTop: 12 }}>
                    <input
                      type="number"
                      min={1}
                      placeholder="Number of installments"
                      value={installmentCount}
                      onChange={(e) => setInstallmentCount(e.target.value)}
                      className={shared.input}
                      style={{ maxWidth: 180 }}
                    />
                    <input
                      type="date"
                      required
                      value={installmentStart}
                      onChange={(e) => setInstallmentStart(e.target.value)}
                      className={shared.input}
                    />
                    <button
                      type="submit"
                      disabled={working || !installmentCount || !installmentStart}
                      className={`${shared.btn} ${shared.btnPrimary}`}
                    >
                      Generate payment plan
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div className={shared.section}>
              <h2 className={shared.sectionTitle}>Agent commission</h2>
              <div className={shared.card}>
                <table className={shared.table}>
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>Rate</th>
                      <th>Amount</th>
                      <th>Status</th>
                      {canManage && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sale.commissions.map((c) => (
                      <tr key={c.id}>
                        <td>{c.agent_name}</td>
                        <td className={shared.tableMuted}>{c.rate_percent}%</td>
                        <td className={shared.tableMuted}>{formatCents(c.amount_cents)}</td>
                        <td>
                          <span className={`${shared.badge} ${c.status === "paid" ? shared.badgeSuccess : shared.badgeWarn}`}>
                            {c.status}
                          </span>
                        </td>
                        {canManage && (
                          <td style={{ textAlign: "right" }}>
                            {c.status !== "paid" && (
                              <button
                                type="button"
                                onClick={() => handleMarkCommissionPaid(c.id)}
                                disabled={working}
                                className={`${shared.btn} ${shared.btnSmall}`}
                              >
                                Mark paid
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                    {sale.commissions.length === 0 && (
                      <tr>
                        <td colSpan={5} className={shared.tableMuted}>
                          {sale.status === "completed"
                            ? "No agent on this sale — no commission."
                            : "Generated automatically once this sale is completed."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </ModuleShell>
  );
}
