"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { RowActions } from "@/components/RowActions";
import {
  api,
  ApiError,
  type Account,
  type BalanceSheet,
  type Bill,
  type Expense,
  type Invoice,
  type JournalEntry,
  type Payment,
  type ProfitAndLoss,
  type TrialBalanceRow,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";

const EMPTY_ACCOUNT_FORM = { code: "", name: "", type: "asset" as Account["type"] };
const EMPTY_JE_LINE = { account: "", debit: "", credit: "" };
const EMPTY_PAYMENT_FORM = {
  direction: "received" as Payment["direction"],
  targetType: "invoice" as "invoice" | "bill" | "expense",
  amount: "",
  method: "cash" as Payment["method"],
  reference: "",
  target: "",
};

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

export default function AccountingPage() {
  const { me, activeMembership, error: sessionError } = useSession();

  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [entries, setEntries] = useState<JournalEntry[] | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[] | null>(null);
  const [profitAndLoss, setProfitAndLoss] = useState<ProfitAndLoss | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT_FORM);
  const [accountWorking, setAccountWorking] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);

  const [jeReference, setJeReference] = useState("");
  const [jeMemo, setJeMemo] = useState("");
  const [jeLines, setJeLines] = useState([{ ...EMPTY_JE_LINE }, { ...EMPTY_JE_LINE }]);
  const [jeWorking, setJeWorking] = useState(false);
  const [jeError, setJeError] = useState<string | null>(null);

  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT_FORM);
  const [paymentWorking, setPaymentWorking] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  async function loadAll() {
    try {
      const [acc, je, pay, inv, bil, exp, tb, pl, bs] = await Promise.all([
        api.listAccounts(),
        api.listJournalEntries(),
        api.listPayments(),
        api.listInvoices(),
        api.listBills(),
        api.listExpenses(),
        api.trialBalance(),
        api.profitAndLoss(),
        api.balanceSheet(),
      ]);
      setAccounts(acc);
      setEntries(je);
      setPayments(pay);
      setInvoices(inv);
      setBills(bil);
      setExpenses(exp);
      setTrialBalance(tb);
      setProfitAndLoss(pl);
      setBalanceSheet(bs);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Failed to load accounting data.");
    }
  }

  useEffect(() => {
    if (activeMembership) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id]);

  async function handleAddAccount(e: React.FormEvent) {
    e.preventDefault();
    setAccountWorking(true);
    setAccountError(null);
    try {
      if (editingAccountId) {
        await api.updateAccount(editingAccountId, accountForm);
      } else {
        await api.createAccount(accountForm);
      }
      setAccountForm(EMPTY_ACCOUNT_FORM);
      setEditingAccountId(null);
      await loadAll();
    } catch (err) {
      setAccountError(err instanceof ApiError ? err.message : "Failed to save account.");
    } finally {
      setAccountWorking(false);
    }
  }

  function startEditAccount(a: Account) {
    setEditingAccountId(a.id);
    setAccountForm({ code: a.code, name: a.name, type: a.type });
  }

  async function handleDeleteAccount(id: number) {
    try {
      await api.deleteAccount(id);
      await loadAll();
    } catch (err) {
      setAccountError(err instanceof ApiError ? err.message : "Failed to delete account.");
    }
  }

  async function handleAddJournalEntry(e: React.FormEvent) {
    e.preventDefault();
    setJeWorking(true);
    setJeError(null);
    try {
      const lines = jeLines
        .filter((l) => l.account && (l.debit || l.credit))
        .map((l) => ({
          account: Number(l.account),
          debit_cents: Math.round(Number(l.debit || 0) * 100),
          credit_cents: Math.round(Number(l.credit || 0) * 100),
        }));
      await api.createJournalEntry({ reference: jeReference, memo: jeMemo, lines });
      setJeReference("");
      setJeMemo("");
      setJeLines([{ ...EMPTY_JE_LINE }, { ...EMPTY_JE_LINE }]);
      await loadAll();
    } catch (err) {
      setJeError(err instanceof ApiError ? err.message : "Failed to create journal entry.");
    } finally {
      setJeWorking(false);
    }
  }

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault();
    setPaymentWorking(true);
    setPaymentError(null);
    try {
      await api.createPayment({
        direction: paymentForm.direction,
        amount_cents: Math.round(Number(paymentForm.amount || 0) * 100),
        method: paymentForm.method,
        reference: paymentForm.reference,
        invoice: paymentForm.targetType === "invoice" ? Number(paymentForm.target) : null,
        bill: paymentForm.targetType === "bill" ? Number(paymentForm.target) : null,
        expense: paymentForm.targetType === "expense" ? Number(paymentForm.target) : null,
      });
      setPaymentForm(EMPTY_PAYMENT_FORM);
      await loadAll();
    } catch (err) {
      setPaymentError(err instanceof ApiError ? err.message : "Failed to record payment.");
    } finally {
      setPaymentWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("accounting.manage") ?? false;
  const accountLabel = (id: number) => {
    const a = accounts?.find((acc) => acc.id === id);
    return a ? `${a.code} ${a.name}` : "—";
  };
  const unpaidInvoices = invoices?.filter((i) => i.status !== "paid" && i.status !== "void") ?? [];
  const unpaidBills = bills?.filter((b) => b.status !== "paid" && b.status !== "void") ?? [];
  const payableExpenses = expenses?.filter((e) => e.status === "approved") ?? [];

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <AppHeader activeMembership={activeMembership} />

      {!activeMembership ? (
        <p style={{ color: "#666" }}>
          Pick an active company on the <a href="/dashboard">dashboard</a> first.
        </p>
      ) : (
        <>
          <h1 style={{ fontSize: 20 }}>Accounting — {activeMembership.company.name}</h1>
          {loadError && <p style={{ color: "crimson" }}>{loadError}</p>}

          {/* Chart of Accounts */}
          <section style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Chart of accounts
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Code</th>
                  <th style={{ padding: "6px 4px" }}>Name</th>
                  <th style={{ padding: "6px 4px" }}>Type</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {accounts?.map((a) => (
                  <tr key={a.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{a.code}</td>
                    <td style={{ padding: "6px 4px" }}>{a.name}</td>
                    <td style={{ padding: "6px 4px" }}>{a.type}</td>
                    {canManage && (
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
                        {a.role ? (
                          <span style={{ fontSize: 12, color: "#999" }} title="A well-known account the posting engine looks up by role — edit/delete disabled to keep auto-posting working.">
                            System account
                          </span>
                        ) : (
                          <RowActions
                            onEdit={() => startEditAccount(a)}
                            onDelete={() => handleDeleteAccount(a.id)}
                            disabled={accountWorking}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {accountError && <p style={{ color: "crimson" }}>{accountError}</p>}
            {canManage && (
              <form onSubmit={handleAddAccount} style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <input
                  placeholder="Code"
                  required
                  value={accountForm.code}
                  onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })}
                  style={{ padding: 8, width: 100 }}
                />
                <input
                  placeholder="Name"
                  required
                  value={accountForm.name}
                  onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                  style={{ padding: 8, flex: 1, maxWidth: 240 }}
                />
                <select
                  value={accountForm.type}
                  onChange={(e) =>
                    setAccountForm({ ...accountForm, type: e.target.value as Account["type"] })
                  }
                  style={{ padding: 8 }}
                >
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="equity">Equity</option>
                  <option value="revenue">Revenue</option>
                  <option value="expense">Expense</option>
                </select>
                <button
                  type="submit"
                  disabled={accountWorking || !accountForm.code || !accountForm.name}
                  style={{ padding: "8px 16px" }}
                >
                  {editingAccountId ? "Save changes" : "Add account"}
                </button>
                {editingAccountId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAccountId(null);
                      setAccountForm(EMPTY_ACCOUNT_FORM);
                    }}
                    style={{ padding: "8px 16px" }}
                  >
                    Cancel
                  </button>
                )}
              </form>
            )}
          </section>

          {/* Journal Entries */}
          <section style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Journal entries
            </h2>
            <p style={{ fontSize: 12, color: "#999", margin: "4px 0 8px" }}>
              Most of these post automatically (invoices, bills, payments) — this list includes those
              alongside any manual entries below.
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Reference</th>
                  <th style={{ padding: "6px 4px" }}>Memo</th>
                  <th style={{ padding: "6px 4px" }}>Lines</th>
                </tr>
              </thead>
              <tbody>
                {entries?.map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                    <td style={{ padding: "6px 4px" }}>{entry.reference}</td>
                    <td style={{ padding: "6px 4px" }}>{entry.memo}</td>
                    <td style={{ padding: "6px 4px" }}>
                      {entry.lines.map((line) => (
                        <div key={line.id}>
                          {accountLabel(line.account)}:{" "}
                          {line.debit_cents ? `Dr ${formatCents(line.debit_cents)}` : `Cr ${formatCents(line.credit_cents)}`}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
                {entries?.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: "6px 4px", color: "#999" }}>
                      No journal entries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form onSubmit={handleAddJournalEntry} style={{ marginTop: 16, maxWidth: 640 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <input
                    placeholder="Reference"
                    value={jeReference}
                    onChange={(e) => setJeReference(e.target.value)}
                    style={{ padding: 8, flex: 1 }}
                  />
                  <input
                    placeholder="Memo"
                    value={jeMemo}
                    onChange={(e) => setJeMemo(e.target.value)}
                    style={{ padding: 8, flex: 1 }}
                  />
                </div>
                {jeLines.map((line, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <select
                      value={line.account}
                      onChange={(e) => {
                        const next = jeLines.slice();
                        next[i] = { ...next[i], account: e.target.value };
                        setJeLines(next);
                      }}
                      style={{ padding: 6, flex: 2 }}
                    >
                      <option value="">Account…</option>
                      {accounts?.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} {a.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Debit"
                      value={line.debit}
                      onChange={(e) => {
                        const next = jeLines.slice();
                        next[i] = { ...next[i], debit: e.target.value, credit: "" };
                        setJeLines(next);
                      }}
                      style={{ padding: 6, width: 100 }}
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Credit"
                      value={line.credit}
                      onChange={(e) => {
                        const next = jeLines.slice();
                        next[i] = { ...next[i], credit: e.target.value, debit: "" };
                        setJeLines(next);
                      }}
                      style={{ padding: 6, width: 100 }}
                    />
                    <button
                      type="button"
                      onClick={() => setJeLines(jeLines.filter((_, idx) => idx !== i))}
                      disabled={jeLines.length === 2}
                      style={{ padding: "4px 10px" }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setJeLines([...jeLines, { ...EMPTY_JE_LINE }])}
                  style={{ padding: "4px 10px", marginTop: 4 }}
                >
                  + Add line
                </button>
                <div>
                  <button type="submit" disabled={jeWorking} style={{ padding: "8px 16px", marginTop: 8 }}>
                    Post journal entry
                  </button>
                </div>
                {jeError && <p style={{ color: "crimson" }}>{jeError}</p>}
              </form>
            )}
          </section>

          {/* Payments */}
          <section style={{ marginTop: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Payments
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Direction</th>
                  <th style={{ padding: "6px 4px" }}>Amount</th>
                  <th style={{ padding: "6px 4px" }}>Method</th>
                  <th style={{ padding: "6px 4px" }}>Reference</th>
                  <th style={{ padding: "6px 4px" }}>Against</th>
                </tr>
              </thead>
              <tbody>
                {payments?.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{p.direction}</td>
                    <td style={{ padding: "6px 4px" }}>{formatCents(p.amount_cents)}</td>
                    <td style={{ padding: "6px 4px" }}>{p.method}</td>
                    <td style={{ padding: "6px 4px" }}>{p.reference || "—"}</td>
                    <td style={{ padding: "6px 4px" }}>
                      {p.invoice
                        ? invoices?.find((i) => i.id === p.invoice)?.invoice_number
                        : p.bill
                          ? bills?.find((b) => b.id === p.bill)?.bill_number
                          : (() => {
                              const exp = expenses?.find((e) => e.id === p.expense);
                              return exp ? `Expense: ${exp.category}` : "—";
                            })()}
                    </td>
                  </tr>
                ))}
                {payments?.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "6px 4px", color: "#999" }}>
                      No payments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form
                onSubmit={handleAddPayment}
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 8,
                  maxWidth: 720,
                }}
              >
                <select
                  value={paymentForm.direction}
                  onChange={(e) => {
                    const direction = e.target.value as Payment["direction"];
                    setPaymentForm({
                      ...paymentForm,
                      direction,
                      targetType: direction === "received" ? "invoice" : "bill",
                      target: "",
                    });
                  }}
                  style={{ padding: 8 }}
                >
                  <option value="received">Received (from customer)</option>
                  <option value="paid">Paid (to supplier or employee)</option>
                </select>
                {paymentForm.direction === "paid" && (
                  <select
                    value={paymentForm.targetType}
                    onChange={(e) =>
                      setPaymentForm({
                        ...paymentForm,
                        targetType: e.target.value as "bill" | "expense",
                        target: "",
                      })
                    }
                    style={{ padding: 8 }}
                  >
                    <option value="bill">Supplier bill</option>
                    <option value="expense">Employee expense</option>
                  </select>
                )}
                <select
                  required
                  value={paymentForm.target}
                  onChange={(e) => setPaymentForm({ ...paymentForm, target: e.target.value })}
                  style={{ padding: 8 }}
                >
                  <option value="">
                    {paymentForm.targetType === "invoice"
                      ? "Invoice…"
                      : paymentForm.targetType === "bill"
                        ? "Bill…"
                        : "Expense…"}
                  </option>
                  {paymentForm.targetType === "invoice" &&
                    unpaidInvoices.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.invoice_number} — {formatCents(i.amount_cents + i.tax_amount_cents)}
                      </option>
                    ))}
                  {paymentForm.targetType === "bill" &&
                    unpaidBills.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bill_number} — {formatCents(b.amount_cents + b.tax_amount_cents)}
                      </option>
                    ))}
                  {paymentForm.targetType === "expense" &&
                    payableExpenses.map((exp) => (
                      <option key={exp.id} value={exp.id}>
                        {exp.category} — {formatCents(exp.amount_cents)}
                      </option>
                    ))}
                </select>
                <input
                  placeholder="Amount"
                  type="number"
                  step="0.01"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  style={{ padding: 8 }}
                />
                <select
                  value={paymentForm.method}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, method: e.target.value as Payment["method"] })
                  }
                  style={{ padding: 8 }}
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="mobile_money">Mobile money</option>
                  <option value="card">Card</option>
                </select>
                <input
                  placeholder="Reference"
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
                  style={{ padding: 8 }}
                />
                <button
                  type="submit"
                  disabled={paymentWorking || !paymentForm.target || !paymentForm.amount}
                  style={{ padding: "8px 16px", gridColumn: "1 / -1", justifySelf: "start" }}
                >
                  Record payment
                </button>
                {paymentError && (
                  <p style={{ color: "crimson", gridColumn: "1 / -1", margin: 0 }}>{paymentError}</p>
                )}
              </form>
            )}
          </section>

          {/* Reports */}
          <section style={{ marginTop: 40, marginBottom: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Reports
            </h2>

            <h3 style={{ fontSize: 13, marginTop: 16 }}>Trial balance</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 4, fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "4px" }}>Account</th>
                  <th style={{ padding: "4px" }}>Debit</th>
                  <th style={{ padding: "4px" }}>Credit</th>
                  <th style={{ padding: "4px" }}>Net</th>
                </tr>
              </thead>
              <tbody>
                {trialBalance?.map((row) => (
                  <tr key={row.account_id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "4px" }}>
                      {row.code} {row.name}
                    </td>
                    <td style={{ padding: "4px" }}>{formatCents(row.total_debit_cents)}</td>
                    <td style={{ padding: "4px" }}>{formatCents(row.total_credit_cents)}</td>
                    <td style={{ padding: "4px" }}>{formatCents(row.net_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: "flex", gap: 40, marginTop: 24, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ fontSize: 13 }}>Profit & loss</h3>
                {profitAndLoss && (
                  <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: "4px 12px 4px 0" }}>Revenue</td>
                        <td style={{ padding: "4px 0", textAlign: "right" }}>
                          {formatCents(profitAndLoss.total_revenue_cents)}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: "4px 12px 4px 0" }}>Expenses</td>
                        <td style={{ padding: "4px 0", textAlign: "right" }}>
                          {formatCents(profitAndLoss.total_expense_cents)}
                        </td>
                      </tr>
                      <tr style={{ borderTop: "1px solid #ddd", fontWeight: 700 }}>
                        <td style={{ padding: "4px 12px 4px 0" }}>Net income</td>
                        <td style={{ padding: "4px 0", textAlign: "right" }}>
                          {formatCents(profitAndLoss.net_income_cents)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>

              <div>
                <h3 style={{ fontSize: 13 }}>Balance sheet</h3>
                {balanceSheet && (
                  <table style={{ borderCollapse: "collapse", fontSize: 13 }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: "4px 12px 4px 0" }}>Total assets</td>
                        <td style={{ padding: "4px 0", textAlign: "right" }}>
                          {formatCents(balanceSheet.total_assets_cents)}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: "4px 12px 4px 0" }}>Total liabilities</td>
                        <td style={{ padding: "4px 0", textAlign: "right" }}>
                          {formatCents(balanceSheet.total_liabilities_cents)}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: "4px 12px 4px 0" }}>Total equity</td>
                        <td style={{ padding: "4px 0", textAlign: "right" }}>
                          {formatCents(balanceSheet.total_equity_cents)}
                        </td>
                      </tr>
                      <tr style={{ borderTop: "1px solid #ddd" }}>
                        <td style={{ padding: "4px 12px 4px 0" }}>Retained earnings (this period)</td>
                        <td style={{ padding: "4px 0", textAlign: "right" }}>
                          {formatCents(balanceSheet.retained_earnings_current_period_cents)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
                {balanceSheet && (
                  <p style={{ fontSize: 11, color: "#999", maxWidth: 320, marginTop: 8 }}>
                    {balanceSheet.note}
                  </p>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
