"use client";

import { useEffect, useMemo, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type GuestFolio, type Reservation } from "@/lib/api";
import { useSession } from "@/lib/useSession";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function RoomChargesPage() {
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
        setLoadError(err instanceof ApiError ? err.message : "Failed to load room charges.");
      }
    }
    if (activeMembership) {
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  const rows = useMemo(() => {
    const out: { id: number; guestName: string; confirmation: string; description: string; amount: number; createdAt: string }[] = [];
    for (const folio of folios ?? []) {
      const reservation = reservations?.find((r) => r.id === folio.reservation);
      for (const c of folio.charges) {
        if (c.source_module !== "room") continue;
        out.push({
          id: c.id,
          guestName: reservation?.guest_name ?? "—",
          confirmation: reservation?.confirmation_number ?? `#${folio.reservation}`,
          description: c.description,
          amount: c.amount_cents,
          createdAt: c.created_at,
        });
      }
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [folios, reservations]);

  const total = rows.reduce((sum, r) => sum + r.amount, 0);

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1000, margin: "40px auto", padding: "0 16px 40px" }}>
        <h1 className="page-title">Room Charges</h1>
        <p className="page-subtitle">Room-rate charges posted to guest folios, across every reservation.</p>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        <div className="panel" style={{ marginTop: 20 }}>
          <div className="section-label">Total</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>{formatCents(total)}</div>
        </div>

        <div className="panel" style={{ marginTop: 12 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Confirmation</th>
                  <th>Guest</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.confirmation}</td>
                    <td style={{ fontWeight: 600 }}>{r.guestName}</td>
                    <td>{r.description}</td>
                    <td>{formatCents(r.amount)}</td>
                    <td>{new Date(r.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={5}>No room charges recorded yet.</td>
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
