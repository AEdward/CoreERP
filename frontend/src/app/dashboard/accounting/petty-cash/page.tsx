"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import {
  api,
  ApiError,
  type Account,
  type EmployeePickerEntry,
  type PettyCashFund,
  type PettyCashTransaction,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";

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

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("accounting.manage") ?? false;
  const employeeName = (id: number) => employees?.find((e) => e.id === id)?.name ?? "—";
  const selectedFund = funds?.find((f) => f.id === selectedId) ?? null;

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <AppHeader activeMembership={activeMembership} />

      {!activeMembership ? (
        <p style={{ color: "#666" }}>
          Pick an active company on the <a href="/dashboard">dashboard</a> first.
        </p>
      ) : (
        <>
          <h1 style={{ fontSize: 20 }}>Petty cash — {activeMembership.company.name}</h1>
          <p style={{ color: "#666", fontSize: 13 }}>
            <a href="/dashboard/accounting">&larr; Back to Accounting</a>
          </p>
          {loadError && <p style={{ color: "crimson" }}>{loadError}</p>}

          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Funds
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}></th>
                  <th style={{ padding: "6px 4px" }}>Name</th>
                  <th style={{ padding: "6px 4px" }}>Custodian</th>
                  <th style={{ padding: "6px 4px" }}>Imprest amount</th>
                  <th style={{ padding: "6px 4px" }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {funds?.map((f) => (
                  <tr
                    key={f.id}
                    style={{
                      borderBottom: "1px solid #eee",
                      background: f.id === selectedId ? "#f5f5f5" : undefined,
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedId(f.id)}
                  >
                    <td style={{ padding: "6px 4px" }}>
                      <input type="radio" checked={f.id === selectedId} onChange={() => setSelectedId(f.id)} />
                    </td>
                    <td style={{ padding: "6px 4px" }}>{f.name}</td>
                    <td style={{ padding: "6px 4px" }}>{employeeName(f.custodian)}</td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(f.imprest_amount_cents)}</td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(f.balance_cents)}</td>
                  </tr>
                ))}
                {funds?.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "6px 4px", color: "#999" }}>
                      No petty cash funds yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form
                onSubmit={handleAddFund}
                style={{
                  marginTop: 16,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 8,
                  maxWidth: 800,
                }}
              >
                <input
                  placeholder="Fund name (e.g. Front desk)"
                  required
                  value={fundForm.name}
                  onChange={(e) => setFundForm({ ...fundForm, name: e.target.value })}
                  style={{ padding: 8 }}
                />
                <select
                  required
                  value={fundForm.custodian}
                  onChange={(e) => setFundForm({ ...fundForm, custodian: e.target.value })}
                  style={{ padding: 8 }}
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
                  style={{ padding: 8 }}
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
                  style={{ padding: 8 }}
                />
                <button
                  type="submit"
                  disabled={fundWorking || !fundForm.name || !fundForm.custodian || !fundForm.account}
                  style={{ padding: 8 }}
                >
                  Add fund
                </button>
                {fundError && (
                  <p style={{ color: "crimson", gridColumn: "1 / -1", margin: 0 }}>{fundError}</p>
                )}
              </form>
            )}
          </section>

          {selectedFund && (
            <section style={{ marginTop: 40, marginBottom: 40 }}>
              <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
                Transactions — {selectedFund.name}
              </h2>
              <p style={{ fontSize: 12, color: "#999", maxWidth: 600 }}>
                Disbursements draw the fund down (expense posted immediately); replenishments top
                it back up to the imprest amount from Cash.
              </p>

              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                    <th style={{ padding: "6px 4px" }}>Date</th>
                    <th style={{ padding: "6px 4px" }}>Type</th>
                    <th style={{ padding: "6px 4px" }}>Category</th>
                    <th style={{ padding: "6px 4px" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions?.map((t) => (
                    <tr key={t.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "6px 4px" }}>{t.date}</td>
                      <td style={{ padding: "6px 4px" }}>
                        {t.type === "disbursement" ? "Disbursement" : "Replenishment"}
                      </td>
                      <td style={{ padding: "6px 4px" }}>
                        {t.category}
                        {t.description && (
                          <div style={{ fontSize: 12, color: "#999" }}>{t.description}</div>
                        )}
                      </td>
                      <td style={{ padding: "6px 4px" }}>{formatCents(t.amount_cents)}</td>
                    </tr>
                  ))}
                  {transactions?.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: "6px 4px", color: "#999" }}>
                        No transactions yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {canManage && (
                <form
                  onSubmit={handleAddTxn}
                  style={{
                    marginTop: 16,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: 8,
                    maxWidth: 800,
                  }}
                >
                  <select
                    value={txnForm.type}
                    onChange={(e) =>
                      setTxnForm({ ...txnForm, type: e.target.value as PettyCashTransaction["type"] })
                    }
                    style={{ padding: 8 }}
                  >
                    <option value="disbursement">Disbursement</option>
                    <option value="replenishment">Replenishment</option>
                  </select>
                  <input
                    placeholder="Category"
                    value={txnForm.category}
                    onChange={(e) => setTxnForm({ ...txnForm, category: e.target.value })}
                    style={{ padding: 8 }}
                  />
                  <input
                    placeholder="Amount"
                    type="number"
                    step="0.01"
                    required
                    value={txnForm.amount}
                    onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })}
                    style={{ padding: 8 }}
                  />
                  <input
                    type="date"
                    required
                    value={txnForm.date}
                    onChange={(e) => setTxnForm({ ...txnForm, date: e.target.value })}
                    style={{ padding: 8 }}
                  />
                  <input
                    placeholder="Description (optional)"
                    value={txnForm.description}
                    onChange={(e) => setTxnForm({ ...txnForm, description: e.target.value })}
                    style={{ padding: 8, gridColumn: "1 / -1" }}
                  />
                  <button type="submit" disabled={txnWorking} style={{ padding: 8 }}>
                    Add transaction
                  </button>
                  {txnError && (
                    <p style={{ color: "crimson", gridColumn: "1 / -1", margin: 0 }}>{txnError}</p>
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
