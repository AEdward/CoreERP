"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type Customer } from "@/lib/api";
import { useSession } from "@/lib/useSession";

export default function VipGuestsPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [guests, setGuests] = useState<Customer[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAll() {
      try {
        setGuests(await api.listCustomers());
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load VIP guests.");
      }
    }
    if (activeMembership) {
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const vipGuests = (guests ?? []).filter((g) => g.type === "vip");

  return (
    <ModuleShell moduleKey="hotel" activeMembership={activeMembership}>
      <main style={{ maxWidth: 1000, margin: "40px auto", padding: "0 16px 40px" }}>
        <h1 className="page-title">VIP Guests</h1>
        <p className="page-subtitle">
          Guests flagged VIP in the Guest Directory — set a guest&apos;s type there to add or remove them here.
        </p>
        {loadError && <p className="error-text" style={{ marginTop: 8 }}>{loadError}</p>}

        <div className="panel" style={{ marginTop: 20 }}>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Nationality</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {vipGuests.map((g) => (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 600 }}>
                      {g.name} <span className="badge badge-gold" style={{ marginLeft: 6 }}>VIP</span>
                    </td>
                    <td>{g.phone || "—"}</td>
                    <td>{g.email || "—"}</td>
                    <td>{g.nationality || "—"}</td>
                    <td>
                      {g.is_registered ? (
                        <span className="badge badge-green">Yes</span>
                      ) : (
                        <span className="badge badge-red">No</span>
                      )}
                    </td>
                  </tr>
                ))}
                {vipGuests.length === 0 && (
                  <tr className="empty-row">
                    <td colSpan={5}>No VIP guests yet.</td>
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
