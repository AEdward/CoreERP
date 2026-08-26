"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type GuestFolio, type Reservation } from "@/lib/api";
import { useSession } from "@/lib/useSession";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function GuestBillingPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [folios, setFolios] = useState<GuestFolio[] | null>(null);
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAll() {
      try {
        const [f, r] = await Promise.all([api.listFolios(), api.listReservations()]);
        setFolios(f);
        setReservations(r);
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load guest billing.");
      }
    }
    if (activeMembership) {
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  const outstanding = useMemo(
    () => (folios ?? []).filter((f) => f.status === "open" && f.balance_cents > 0),
    [folios]
  );
  const totalOutstandingCents = useMemo(
    () => outstanding.reduce((sum, f) => sum + f.balance_cents, 0),
    [outstanding]
  );
  const openCount = useMemo(() => (folios ?? []).filter((f) => f.status === "open").length, [folios]);
  const closedCount = useMemo(() => (folios ?? []).filter((f) => f.status === "closed").length, [folios]);

  const sortedFolios = useMemo(
    () => (folios ?? []).slice().sort((a, b) => b.balance_cents - a.balance_cents),
    [folios]
  );

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const reservationFor = (id: number) => reservations?.find((r) => r.id === id) ?? null;

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 16px 40px" }}>
        <h1 className="page-title">Guest Billing</h1>
        <p className="page-subtitle">Outstanding balances across every folio — sorted highest first.</p>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 20 }}>
          <div className="panel">
            <div className="section-label">Total Outstanding</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: totalOutstandingCents ? "#a6392c" : undefined, marginTop: 6 }}>
              {formatCents(totalOutstandingCents)}
            </div>
          </div>
          <div className="panel">
            <div className="section-label">Open Folios</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{openCount}</div>
          </div>
          <div className="panel">
            <div className="section-label">Closed Folios</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{closedCount}</div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 12 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reservation</th>
                  <th>Guest</th>
                  <th>Status</th>
                  <th>Balance</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedFolios.map((folio) => {
                  const reservation = reservationFor(folio.reservation);
                  return (
                    <tr key={folio.id}>
                      <td>{reservation?.confirmation_number ?? `Reservation #${folio.reservation}`}</td>
                      <td style={{ fontWeight: 600 }}>{reservation?.guest_name ?? "—"}</td>
                      <td>
                        <span className={`badge ${folio.status === "open" ? "badge-gold" : "badge-gray"}`}>
                          {folio.status}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${folio.balance_cents > 0 ? "badge-red" : "badge-green"}`}>
                          {formatCents(folio.balance_cents)}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link href="/dashboard/hotel/guest-folios" className="btn btn-secondary btn-sm">
                          View charges
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {sortedFolios.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={5}>No folios yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </ModuleShell>
  );
}
