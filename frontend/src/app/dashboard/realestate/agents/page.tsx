"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import { api, ApiError, type AgentCommission, type SalesAgent } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const EMPTY_FORM = { name: "", phone: "", email: "", commission_rate_percent: "3" };

export default function SalesAgentsPage() {
  const { me, activeMembership, error: sessionError } = useSession();
  const [agents, setAgents] = useState<SalesAgent[] | null>(null);
  const [commissions, setCommissions] = useState<AgentCommission[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  async function loadAll() {
    try {
      const [a, c] = await Promise.all([api.listSalesAgents(), api.listAgentCommissions()]);
      setAgents(a);
      setCommissions(c);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load sales agents.");
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
      await api.createSalesAgent({
        name: form.name,
        phone: form.phone,
        email: form.email,
        commission_rate_percent: form.commission_rate_percent,
      });
      setForm(EMPTY_FORM);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to save sales agent.");
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.deleteSalesAgent(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to delete sales agent.");
    }
  }

  async function handleMarkPaid(id: number) {
    setWorking(true);
    try {
      await api.markCommissionPaid(id);
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to mark commission paid.");
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
            <h1 className={shared.pageTitle}>Sales Agents</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.section}>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact</th>
                  <th>Commission rate</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {agents?.map((a) => (
                  <tr key={a.id}>
                    <td>{a.name}</td>
                    <td className={shared.tableMuted}>{[a.phone, a.email].filter(Boolean).join(" / ") || "—"}</td>
                    <td className={shared.tableMuted}>{a.commission_rate_percent}%</td>
                    {canManage && (
                      <td style={{ textAlign: "right" }}>
                        <RowActions onDelete={() => handleDelete(a.id)} disabled={working} />
                      </td>
                    )}
                  </tr>
                ))}
                {agents?.length === 0 && (
                  <tr>
                    <td colSpan={4} className={shared.tableMuted}>
                      No sales agents yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {canManage && (
              <form onSubmit={handleCreate} className={shared.formRow} style={{ marginTop: 12 }}>
                <input
                  placeholder="Agent name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={shared.input}
                />
                <input
                  type="number"
                  min={0}
                  step="0.1"
                  placeholder="Commission %"
                  value={form.commission_rate_percent}
                  onChange={(e) => setForm({ ...form, commission_rate_percent: e.target.value })}
                  className={shared.input}
                  style={{ maxWidth: 120 }}
                />
                <button type="submit" disabled={working || !form.name} className={`${shared.btn} ${shared.btnPrimary}`}>
                  Add agent
                </button>
              </form>
            )}
          </div>
        </div>

        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>Commissions</h2>
          <div className={shared.card}>
            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Sale</th>
                  <th>Rate</th>
                  <th>Amount</th>
                  <th>Status</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {commissions?.map((c) => (
                  <tr key={c.id}>
                    <td>{c.agent_name}</td>
                    <td className={shared.tableMuted}>
                      <a href={`/dashboard/realestate/sales/${c.sale}`}>#{c.sale}</a>
                    </td>
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
                            onClick={() => handleMarkPaid(c.id)}
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
                {commissions?.length === 0 && (
                  <tr>
                    <td colSpan={6} className={shared.tableMuted}>
                      No commissions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
