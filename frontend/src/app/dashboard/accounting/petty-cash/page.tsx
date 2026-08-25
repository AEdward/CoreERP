"use client";

import { useEffect, useState } from "react";
import { ModuleShell } from "@/components/ModuleShell";
import {
  api,
  ApiError,
  type Account,
  type EmployeePickerEntry,
  type PettyCashFund,
  type PettyCashTransaction,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

const EMPTY_FUND_FORM = { name: "", custodian: "", account: "", imprest_amount: "" };
const EMPTY_TXN_FORM = {
  type: "disbursement" as PettyCashTransaction["type"],
  category: "",
  description: "",
  amount: "",
  date: "",
};

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function PettyCashPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [funds, setFunds] = useState<PettyCashFund[] | null>(null);
  const [employees, setEmployees] = useState<EmployeePickerEntry[] | null>(null);
  const [glAccounts, setGlAccounts] = useState<Account[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<PettyCashTransaction[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fundForm, setFundForm] = useState(EMPTY_FUND_FORM);
  const [fundWorking, setFundWorking] = useState(false);
  const [fundError, setFundError] = useState<string | null>(null);

  const [txnForm, setTxnForm] = useState(EMPTY_TXN_FORM);
  const [txnWorking, setTxnWorking] = useState(false);
  const [txnError, setTxnError] = useState<string | null>(null);

  async function loadFunds() {
    try {
      const [f, emp, gl] = await Promise.all([
        api.listPettyCashFunds(),
        api.listEmployeePicker(),
        api.listAccounts(),
      ]);
      setFunds(f);
      setEmployees(emp);
      setGlAccounts(gl);
      if (selectedId === null && f.length > 0) setSelectedId(f[0].id);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load petty cash funds.");
    }
  }

  async function loadTransactions(fundId: number) {
    try {
      const t = await api.listPettyCashTransactions(fundId);
      setTransactions(t);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load transactions.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadFunds();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  useEffect(() => {
    if (selectedId !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadTransactions(selectedId);
    }
  }, [selectedId]);

  async function handleAddFund(e: React.FormEvent) {
    e.preventDefault();
    setFundWorking(true);
    setFundError(null);
    try {
      const created = await api.createPettyCashFund({
        name: fundForm.name,
        custodian: Number(fundForm.custodian),
        account: Number(fundForm.account),
        imprest_amount_cents: Math.round(Number(fundForm.imprest_amount || 0) * 100),
      });
      setFundForm(EMPTY_FUND_FORM);
      await loadFunds();
      setSelectedId(created.id);
    } catch (err) {
      setFundError(err instanceof ApiError ? err.message : "Failed to add petty cash fund.");
    } finally {
      setFundWorking(false);
    }
  }

  async function handleAddTxn(e: React.FormEvent) {
    e.preventDefault();
    if (selectedId === null) return;
    setTxnWorking(true);
    setTxnError(null);
    try {
      await api.createPettyCashTransaction({
        fund: selectedId,
        type: txnForm.type,
        category: txnForm.category,
        description: txnForm.description,
        amount_cents: Math.round(Number(txnForm.amount || 0) * 100),
        date: txnForm.date,
      });
      setTxnForm(EMPTY_TXN_FORM);
      await Promise.all([loadTransactions(selectedId), loadFunds()]);
    } catch (err) {
      setTxnError(err instanceof ApiError ? err.message : "Failed to record transaction.");
    } finally {
      setTxnWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("accounting.manage") ?? false;
  const employeeName = (id: number) => employees?.find((e) => e.id === id)?.name ?? "—";
  const selectedFund = funds?.find((f) => f.id === selectedId) ?? null;

  return (
    <ModuleShell moduleKey="accounting" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Petty cash</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        <div className={shared.card} style={{ marginBottom: 24 }}>
          <h2 className={shared.sectionTitle}>Funds</h2>
          <table className={shared.table}>
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>Custodian</th>
                <th>Imprest amount</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {funds?.map((f) => (
                <tr
                  key={f.id}
                  style={{
                    background: f.id === selectedId ? "var(--gray-50)" : undefined,
                    cursor: "pointer",
                  }}
                  onClick={() => setSelectedId(f.id)}
                >
                  <td>
                    <input type="radio" checked={f.id === selectedId} onChange={() => setSelectedId(f.id)} />
                  </td>
                  <td>{f.name}</td>
                  <td>{employeeName(f.custodian)}</td>
                  <td>{formatCents(f.imprest_amount_cents)}</td>
                  <td>{formatCents(f.balance_cents)}</td>
                </tr>
              ))}
              {funds?.length === 0 && (
                <tr>
                  <td colSpan={5} className={shared.tableMuted}>
                    No petty cash funds yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {canManage && (
            <form onSubmit={handleAddFund} className={shared.formGrid} style={{ marginTop: 16 }}>
              <input
                placeholder="Fund name (e.g. Front desk)"
                required
                value={fundForm.name}
                onChange={(e) => setFundForm({ ...fundForm, name: e.target.value })}
                className={shared.input}
              />
              <select
                required
                value={fundForm.custodian}
                onChange={(e) => setFundForm({ ...fundForm, custodian: e.target.value })}
                className={shared.select}
              >
                <option value="">Custodian…</option>
                {employees?.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
              <select
                required
                value={fundForm.account}
                onChange={(e) => setFundForm({ ...fundForm, account: e.target.value })}
                className={shared.select}
              >
                <option value="">GL account…</option>
                {glAccounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} {a.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="Imprest amount"
                type="number"
                step="0.01"
                required
                value={fundForm.imprest_amount}
                onChange={(e) => setFundForm({ ...fundForm, imprest_amount: e.target.value })}
                className={shared.input}
              />
              <button
                type="submit"
                disabled={fundWorking || !fundForm.name || !fundForm.custodian || !fundForm.account}
                className={`${shared.btn} ${shared.btnPrimary}`}
              >
                Add fund
              </button>
              {fundError && (
                <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                  {fundError}
                </p>
              )}
            </form>
          )}
        </div>

        {selectedFund && (
          <div className={shared.card}>
            <h2 className={shared.sectionTitle}>Transactions — {selectedFund.name}</h2>
            <p className={shared.hint} style={{ maxWidth: 600, marginBottom: 8 }}>
              Disbursements draw the fund down (expense posted immediately); replenishments top
              it back up to the imprest amount from Cash.
            </p>

            <table className={shared.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions?.map((t) => (
                  <tr key={t.id}>
                    <td>{t.date}</td>
                    <td>
                      {t.type === "disbursement" ? "Disbursement" : "Replenishment"}
                    </td>
                    <td>
                      {t.category}
                      {t.description && <div className={shared.tableMuted}>{t.description}</div>}
                    </td>
                    <td>{formatCents(t.amount_cents)}</td>
                  </tr>
                ))}
                {transactions?.length === 0 && (
                  <tr>
                    <td colSpan={4} className={shared.tableMuted}>
                      No transactions yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form onSubmit={handleAddTxn} className={shared.formGrid} style={{ marginTop: 16 }}>
                <select
                  value={txnForm.type}
                  onChange={(e) =>
                    setTxnForm({ ...txnForm, type: e.target.value as PettyCashTransaction["type"] })
                  }
                  className={shared.select}
                >
                  <option value="disbursement">Disbursement</option>
                  <option value="replenishment">Replenishment</option>
                </select>
                <input
                  placeholder="Category"
                  value={txnForm.category}
                  onChange={(e) => setTxnForm({ ...txnForm, category: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Amount"
                  type="number"
                  step="0.01"
                  required
                  value={txnForm.amount}
                  onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })}
                  className={shared.input}
                />
                <input
                  type="date"
                  required
                  value={txnForm.date}
                  onChange={(e) => setTxnForm({ ...txnForm, date: e.target.value })}
                  className={shared.input}
                />
                <input
                  placeholder="Description (optional)"
                  value={txnForm.description}
                  onChange={(e) => setTxnForm({ ...txnForm, description: e.target.value })}
                  className={shared.input}
                  style={{ gridColumn: "1 / -1" }}
                />
                <button type="submit" disabled={txnWorking} className={`${shared.btn} ${shared.btnPrimary}`}>
                  Add transaction
                </button>
                {txnError && (
                  <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                    {txnError}
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
