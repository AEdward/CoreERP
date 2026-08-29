"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type Customer, type GiftCard } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const STATUS_BADGES: Record<GiftCard["status"], string> = {
  active: shared.badgeSuccess,
  redeemed: "",
  expired: shared.badgeDanger,
};

const EMPTY_FORM = { code: "", initial_balance_cents: "", issued_to: "", issued_date: "" };

export default function GiftCardsPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [giftCards, setGiftCards] = useState<GiftCard[] | null>(null);
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [amounts, setAmounts] = useState<Record<number, string>>({});

  async function loadAll() {
    try {
      const [g, c] = await Promise.all([api.listGiftCards(), api.listCustomers()]);
      setGiftCards(g);
      setCustomers(c);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load gift cards.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    setWorking(true);
    try {
      await api.issueGiftCard({
        code: form.code,
        initial_balance_cents: Math.round(Number(form.initial_balance_cents) * 100),
        issued_to: form.issued_to ? Number(form.issued_to) : null,
        issued_date: form.issued_date,
      });
      setForm(EMPTY_FORM);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to issue gift card.");
    } finally {
      setWorking(false);
    }
  }

  async function handleRedeem(id: number) {
    const amount = amounts[id];
    if (!amount) return;
    setWorking(true);
    try {
      await api.redeemGiftCard(id, Math.round(Number(amount) * 100));
      setAmounts({ ...amounts, [id]: "" });
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to redeem gift card.");
    } finally {
      setWorking(false);
    }
  }

  async function handleReload(id: number) {
    const amount = amounts[id];
    if (!amount) return;
    setWorking(true);
    try {
      await api.reloadGiftCard(id, Math.round(Number(amount) * 100));
      setAmounts({ ...amounts, [id]: "" });
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to reload gift card.");
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
            <h1 className={shared.pageTitle}>Gift Cards</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.section}>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Issued to</th>
                  <th>Balance</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {giftCards?.map((g) => (
                  <tr key={g.id}>
                    <td>{g.code}</td>
                    <td className={shared.tableMuted}>{g.issued_to_name || "—"}</td>
                    <td className={shared.tableMuted}>
                      {formatCents(g.balance_cents)} / {formatCents(g.initial_balance_cents)}
                    </td>
                    <td>
                      <span className={`${shared.badge} ${STATUS_BADGES[g.status]}`}>{g.status}</span>
                    </td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        {g.status === "active" && (
                          <span style={{ display: "inline-flex", gap: 6 }}>
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              placeholder="Amount"
                              value={amounts[g.id] ?? ""}
                              onChange={(e) => setAmounts({ ...amounts, [g.id]: e.target.value })}
                              className={shared.input}
                              style={{ maxWidth: 90 }}
                            />
                            <button
                              type="button"
                              onClick={() => handleRedeem(g.id)}
                              disabled={working || !amounts[g.id]}
                              className={`${shared.btn} ${shared.btnSmall}`}
                            >
                              Redeem
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReload(g.id)}
                              disabled={working || !amounts[g.id]}
                              className={`${shared.btn} ${shared.btnSmall}`}
                            >
                              Reload
                            </button>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {giftCards?.length === 0 && (
                  <tr>
                    <td colSpan={5} className={shared.tableMuted}>
                      No gift cards yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleIssue} className={shared.formRow} style={{ marginTop: 12 }}>
                <input
                  placeholder="Code"
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 140 }}
                />
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Initial balance"
                  required
                  value={form.initial_balance_cents}
                  onChange={(e) => setForm({ ...form, initial_balance_cents: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 130 }}
                />
                <select
                  value={form.issued_to}
                  onChange={(e) => setForm({ ...form, issued_to: e.target.value })}
                  className={shared.select}
                >
                  <option value="">No customer…</option>
                  {customers?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="date"
                  required
                  value={form.issued_date}
                  onChange={(e) => setForm({ ...form, issued_date: e.target.value })}
                  className={shared.input}
                />
                <button
                  type="submit"
                  disabled={working || !form.code || !form.initial_balance_cents || !form.issued_date}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                >
                  Issue gift card
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
