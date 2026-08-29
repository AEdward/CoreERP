"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type LeaseContract } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const STATUS_BADGES: Record<LeaseContract["status"], string> = {
  active: shared.badgeSuccess,
  terminated: shared.badgeDanger,
  expired: shared.badgeWarn,
};

export default function LeaseDetailPage() {
  const params = useParams<{ id: string }>();
  const leaseId = Number(params.id);
  const { me, activeMembership, error: sessionError } = useSession();

  const [lease, setLease] = useState<LeaseContract | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function load() {
    try {
      setLease(await api.getLeaseContract(leaseId));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load lease.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id, leaseId]);

  async function handleGenerateSchedule() {
    setWorking(true);
    setActionError(null);
    try {
      await api.generateRentSchedule(leaseId);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to generate rent schedule.");
    } finally {
      setWorking(false);
    }
  }

  async function handleTerminate() {
    if (!confirm("Terminate this lease?")) return;
    setWorking(true);
    setActionError(null);
    try {
      await api.terminateLease(leaseId);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to terminate lease.");
    } finally {
      setWorking(false);
    }
  }

  async function handleRecordPayment(id: number) {
    setWorking(true);
    setActionError(null);
    try {
      await api.recordRentPayment(id);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to record payment.");
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
            <h1 className={shared.pageTitle}>{lease?.number ?? "Lease Contract"}</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
            <p className={shared.hint} style={{ marginTop: 4 }}>
              <Link href="/dashboard/realestate/leasing">&larr; Back to leasing</Link>
            </p>
          </div>
          {lease && (
            <div className={shared.pageActions}>
              <span className={`${shared.badge} ${STATUS_BADGES[lease.status]}`}>{lease.status}</span>
              {canManage && lease.status === "active" && (
                <button type="button" onClick={handleTerminate} disabled={working} className={`${shared.btn} ${shared.btnDanger}`}>
                  Terminate lease
                </button>
              )}
            </div>
          )}
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}
        {actionError && <p className={shared.errorText}>{actionError}</p>}

        {lease && (
          <>
            <div className={shared.section}>
              <div className={shared.card}>
                <div className={shared.formGrid}>
                  <div>
                    <div className={shared.label}>Unit</div>
                    <div>{lease.unit_label}</div>
                  </div>
                  <div>
                    <div className={shared.label}>Tenant</div>
                    <div>{lease.tenant_name}</div>
                  </div>
                  <div>
                    <div className={shared.label}>Term</div>
                    <div>
                      {lease.start_date} → {lease.end_date}
                    </div>
                  </div>
                  <div>
                    <div className={shared.label}>Monthly rent</div>
                    <div>{formatCents(lease.monthly_rent_cents)}</div>
                  </div>
                  <div>
                    <div className={shared.label}>Deposit</div>
                    <div>{formatCents(lease.deposit_cents)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className={shared.section}>
              <h2 className={shared.sectionTitle}>Rent collection</h2>
              <div className={shared.card}>
                <table className={shared.table}>
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Due</th>
                      <th>Amount</th>
                      <th>Status</th>
                      {canManage && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {lease.rent_payments.map((p) => (
                      <tr key={p.id}>
                        <td>
                          {p.period_start} → {p.period_end}
                        </td>
                        <td className={shared.tableMuted}>{p.due_date}</td>
                        <td className={shared.tableMuted}>{formatCents(p.amount_cents)}</td>
                        <td>
                          <span className={`${shared.badge} ${p.status === "paid" ? shared.badgeSuccess : shared.badgeWarn}`}>
                            {p.status}
                          </span>
                        </td>
                        {canManage && (
                          <td style={{ textAlign: "right" }}>
                            {p.status !== "paid" && (
                              <button
                                type="button"
                                onClick={() => handleRecordPayment(p.id)}
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
                    {lease.rent_payments.length === 0 && (
                      <tr>
                        <td colSpan={5} className={shared.tableMuted}>
                          No rent schedule yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {canManage && lease.rent_payments.length === 0 && (
                  <button
                    type="button"
                    onClick={handleGenerateSchedule}
                    disabled={working}
                    className={`${shared.btn} ${shared.btnPrimary}`}
                    style={{ marginTop: 12 }}
                  >
                    Generate rent schedule
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </ModuleShell>
  );
}
