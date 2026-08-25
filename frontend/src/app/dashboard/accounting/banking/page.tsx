"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import { api, ApiError, type Account, type BankAccount, type BankStatementLine } from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

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

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("accounting.manage") ?? false;
  const selectedAccount = bankAccounts?.find((b) => b.id === selectedId) ?? null;
  const reconciledTotal = lines?.filter((l) => l.is_reconciled).reduce((sum, l) => sum + l.amount_cents, 0) ?? 0;
  const unreconciledTotal =
    lines?.filter((l) => !l.is_reconciled).reduce((sum, l) => sum + l.amount_cents, 0) ?? 0;

  return (
    <ModuleShell moduleKey="accounting" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Bank accounts &amp; reconciliation</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.card} style={{ marginBottom: 24 }}>
          <h2 className={shared.sectionTitle}>Bank accounts</h2>
          <table className={shared.table}>
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>Bank</th>
                <th>Account #</th>
                <th>GL balance</th>
              </tr>
            </thead>
            <tbody>
              {bankAccounts?.map((b) => (
                <tr
                  key={b.id}
                  style={{
                    background: b.id === selectedId ? "var(--gray-50)" : undefined,
                    cursor: "pointer",
                  }}
                  onClick={() => setSelectedId(b.id)}
                >
                  <td>
                    <input type="radio" checked={b.id === selectedId} onChange={() => setSelectedId(b.id)} />
                  </td>
                  <td>{b.name}</td>
                  <td>{b.bank_name}</td>
                  <td>{b.account_number}</td>
                  <td>{formatCents(b.balance_cents)}</td>
                </tr>
              ))}
              {bankAccounts?.length === 0 && (
                <tr>
                  <td colSpan={5} className={shared.tableMuted}>
                    No bank accounts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {canManage && (
            <form onSubmit={handleAddAccount} className={shared.formGrid} style={{ marginTop: 16 }}>
              <input
                placeholder="Name (e.g. Operating account)"
                required
                value={accountForm.name}
                onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                className={shared.input}
              />
              <input
                placeholder="Bank name"
                value={accountForm.bank_name}
                onChange={(e) => setAccountForm({ ...accountForm, bank_name: e.target.value })}
                className={shared.input}
              />
              <input
                placeholder="Account number"
                value={accountForm.account_number}
                onChange={(e) => setAccountForm({ ...accountForm, account_number: e.target.value })}
                className={shared.input}
              />
              <select
                required
                value={accountForm.account}
                onChange={(e) => setAccountForm({ ...accountForm, account: e.target.value })}
                className={shared.select}
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
                className={`${shared.btn} ${shared.btnPrimary}`}
              >
                Add bank account
              </button>
              {accountError && (
                <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                  {accountError}
                </p>
              )}
            </form>
          )}
        </div>

        {selectedAccount && (
          <div className={shared.card}>
            <h2 className={shared.sectionTitle}>Statement lines — {selectedAccount.name}</h2>
            <p className={shared.hint} style={{ maxWidth: 600 }}>
              Enter each line from your bank statement, then tick it off against the GL as you
              confirm it. This is manual reconciliation — nothing is imported or auto-matched.
            </p>
            <p style={{ fontSize: 13, marginTop: 8, marginBottom: 8 }}>
              Reconciled: {formatCents(reconciledTotal)} &nbsp;|&nbsp; Unreconciled:{" "}
              {formatCents(unreconciledTotal)} &nbsp;|&nbsp; GL balance:{" "}
              {formatCents(selectedAccount.balance_cents)}
            </p>

            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Reconciled</th>
                </tr>
              </thead>
              <tbody>
                {lines?.map((l) => (
                  <tr key={l.id}>
                    <td>{l.date}</td>
                    <td>{l.description}</td>
                    <td>{formatCents(l.amount_cents)}</td>
                    <td>
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
                    <td colSpan={4} className={shared.tableMuted}>
                      No statement lines yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form onSubmit={handleAddLine} className={shared.formGrid} style={{ marginTop: 16 }}>
                <input
                  type="date"
                  required
                  value={lineForm.date}
                  onChange={(e) => setLineForm({ ...lineForm, date: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Description"
                  value={lineForm.description}
                  onChange={(e) => setLineForm({ ...lineForm, description: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Amount (negative for withdrawal)"
                  type="number"
                  step="0.01"
                  required
                  value={lineForm.amount}
                  onChange={(e) => setLineForm({ ...lineForm, amount: e.target.value })}
                  className={shared.input}
                />
                <button type="submit" disabled={lineWorking} className={`${shared.btn} ${shared.btnPrimary}`}>
                  Add line
                </button>
                {lineError && (
                  <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                    {lineError}
                  </p>
                )}
              </form>
            )}
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
