"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { api, ApiError, type Account, type BankAccount, type BankStatementLine } from "@/lib/api";
import { useSession } from "@/lib/useSession";

const EMPTY_ACCOUNT_FORM = { name: "", bank_name: "", account_number: "", account: "" };
const EMPTY_LINE_FORM = { date: "", description: "", amount: "" };

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function BankingPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [bankAccounts, setBankAccounts] = useState<BankAccount[] | null>(null);
  const [glAccounts, setGlAccounts] = useState<Account[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [lines, setLines] = useState<BankStatementLine[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM);
  const [accountWorking, setAccountWorking] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const [lineForm, setLineForm] = useState(EMPTY_LINE_FORM);
  const [lineWorking, setLineWorking] = useState(false);
  const [lineError, setLineError] = useState<string | null>(null);

  async function loadAccounts() {
    try {
      const [ba, gl] = await Promise.all([api.listBankAccounts(), api.listAccounts()]);
      setBankAccounts(ba);
      setGlAccounts(gl);
      if (selectedId === null && ba.length > 0) setSelectedId(ba[0].id);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load bank accounts.");
    }
  }

  async function loadLines(bankAccountId: number) {
    try {
      const l = await api.listBankStatementLines(bankAccountId);
      setLines(l);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load statement lines.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAccounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  useEffect(() => {
    if (selectedId !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadLines(selectedId);
    }
  }, [selectedId]);

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    setAccountWorking(true);
    setAccountError(null);
    try {
      const created = await api.createBankAccount({
        name: accountForm.name,
        bank_name: accountForm.bank_name,
        account_number: accountForm.account_number,
        account: Number(accountForm.account),
      });
      setAccountForm(EMPTY_ACCOUNT_FORM);
      await loadAccounts();
      setSelectedId(created.id);
    } catch (err) {
      setAccountError(err instanceof ApiError ? err.message : "Failed to add bank account.");
    } finally {
      setAccountWorking(false);
    }
  }

  async function handleAddLine(e: React.FormEvent) {
    e.preventDefault();
    if (selectedId === null) return;
    setLineWorking(true);
    setLineError(null);
    try {
      await api.createBankStatementLine({
        bank_account: selectedId,
        date: lineForm.date,
        description: lineForm.description,
        amount_cents: Math.round(Number(lineForm.amount || 0) * 100),
      });
      setLineForm(EMPTY_LINE_FORM);
      await loadLines(selectedId);
    } catch (err) {
      setLineError(err instanceof ApiError ? err.message : "Failed to add statement line.");
    } finally {
      setLineWorking(false);
    }
  }

  async function handleToggleReconciled(line: BankStatementLine) {
    try {
      await api.updateBankStatementLine(line.id, { is_reconciled: !line.is_reconciled });
      if (selectedId !== null) await loadLines(selectedId);
    } catch (err) {
      setLineError(err instanceof ApiError ? err.message : "Failed to update line.");
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("accounting.manage") ?? false;
  const selectedAccount = bankAccounts?.find((b) => b.id === selectedId) ?? null;
  const reconciledTotal = lines?.filter((l) => l.is_reconciled).reduce((sum, l) => sum + l.amount_cents, 0) ?? 0;
  const unreconciledTotal =
    lines?.filter((l) => !l.is_reconciled).reduce((sum, l) => sum + l.amount_cents, 0) ?? 0;

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <AppHeader activeMembership={activeMembership} />

      {!activeMembership ? (
        <p style={{ color: "#666" }}>
          Pick an active company on the <a href="/dashboard">dashboard</a> first.
        </p>
      ) : (
        <>
          <h1 style={{ fontSize: 20 }}>Bank accounts & reconciliation — {activeMembership.company.name}</h1>
          <p style={{ color: "#666", fontSize: 13 }}>
            <a href="/dashboard/accounting">&larr; Back to Accounting</a>
          </p>
          {loadError && <p style={{ color: "crimson" }}>{loadError}</p>}

          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Bank accounts
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}></th>
                  <th style={{ padding: "6px 4px" }}>Name</th>
                  <th style={{ padding: "6px 4px" }}>Bank</th>
                  <th style={{ padding: "6px 4px" }}>Account #</th>
                  <th style={{ padding: "6px 4px" }}>GL balance</th>
                </tr>
              </thead>
              <tbody>
                {bankAccounts?.map((b) => (
                  <tr
                    key={b.id}
                    style={{
                      borderBottom: "1px solid #eee",
                      background: b.id === selectedId ? "#f5f5f5" : undefined,
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedId(b.id)}
                  >
                    <td style={{ padding: "6px 4px" }}>
                      <input type="radio" checked={b.id === selectedId} onChange={() => setSelectedId(b.id)} />
                    </td>
                    <td style={{ padding: "6px 4px" }}>{b.name}</td>
                    <td style={{ padding: "6px 4px" }}>{b.bank_name}</td>
                    <td style={{ padding: "6px 4px" }}>{b.account_number}</td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(b.balance_cents)}</td>
                  </tr>
                ))}
                {bankAccounts?.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "6px 4px", color: "#999" }}>
                      No bank accounts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form
                onSubmit={handleAddAccount}
                style={{
                  marginTop: 16,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 8,
                  maxWidth: 800,
                }}
              >
                <input
                  placeholder="Name (e.g. Operating account)"
                  required
                  value={accountForm.name}
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Bank name"
                  value={accountForm.bank_name}
                  onChange={(e) => setAccountForm({ ...accountForm, bank_name: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  placeholder="Account number"
                  value={accountForm.account_number}
                  onChange={(e) => setAccountForm({ ...accountForm, account_number: e.target.value })}
                  style={{ padding: 8 }}
                />
                <select
                  required
                  value={accountForm.account}
                  onChange={(e) => setAccountForm({ ...accountForm, account: e.target.value })}
                  style={{ padding: 8 }}
                >
                  <option value="">GL account…</option>
                  {glAccounts?.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} {a.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={accountWorking || !accountForm.name || !accountForm.account}
                  style={{ padding: 8 }}
                >
                  Add bank account
                </button>
                {accountError && (
                  <p style={{ color: "crimson", gridColumn: "1 / -1", margin: 0 }}>{accountError}</p>
                )}
              </form>
            )}
          </section>

          {selectedAccount && (
            <section style={{ marginTop: 40, marginBottom: 40 }}>
              <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
                Statement lines — {selectedAccount.name}
              </h2>
              <p style={{ fontSize: 12, color: "#999", maxWidth: 600 }}>
                Enter each line from your bank statement, then tick it off against the GL as you
                confirm it. This is manual reconciliation — nothing is imported or auto-matched.
              </p>
              <p style={{ fontSize: 13 }}>
                Reconciled: {formatCents(reconciledTotal)} &nbsp;|&nbsp; Unreconciled:{" "}
                {formatCents(unreconciledTotal)} &nbsp;|&nbsp; GL balance:{" "}
                {formatCents(selectedAccount.balance_cents)}
              </p>

              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                    <th style={{ padding: "6px 4px" }}>Date</th>
                    <th style={{ padding: "6px 4px" }}>Description</th>
                    <th style={{ padding: "6px 4px" }}>Amount</th>
                    <th style={{ padding: "6px 4px" }}>Reconciled</th>
                  </tr>
                </thead>
                <tbody>
                  {lines?.map((l) => (
                    <tr key={l.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "6px 4px" }}>{l.date}</td>
                      <td style={{ padding: "6px 4px" }}>{l.description}</td>
                      <td style={{ padding: "6px 4px" }}>{formatCents(l.amount_cents)}</td>
                      <td style={{ padding: "6px 4px" }}>
                        <input
                          type="checkbox"
                          checked={l.is_reconciled}
                          disabled={!canManage}
                          onChange={() => handleToggleReconciled(l)}
                        />
                      </td>
                    </tr>
                  ))}
                  {lines?.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: "6px 4px", color: "#999" }}>
                        No statement lines yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {canManage && (
                <form
                  onSubmit={handleAddLine}
                  style={{
                    marginTop: 16,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: 8,
                    maxWidth: 700,
                  }}
                >
                  <input
                    type="date"
                    required
                    value={lineForm.date}
                    onChange={(e) => setLineForm({ ...lineForm, date: e.target.value })}
                    style={{ padding: 8 }}
                  />
                  <input
                    placeholder="Description"
                    value={lineForm.description}
                    onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })}
                    style={{ padding: 8 }}
                  />
                  <input
                    placeholder="Amount (negative for withdrawal)"
                    type="number"
                    step="0.01"
                    required
                    value={lineForm.amount}
                    onChange={(e) => setLineForm({ ...lineForm, amount: e.target.value })}
                    style={{ padding: 8 }}
                  />
                  <button type="submit" disabled={lineWorking} style={{ padding: 8 }}>
                    Add line
                  </button>
                  {lineError && (
                    <p style={{ color: "crimson", gridColumn: "1 / -1", margin: 0 }}>{lineError}</p>
                  )}
                </form>
              )}
            </section>
          )}
        </>
      )}
    </main>
  );
}
