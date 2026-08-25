"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ModuleShell } from "@/components/ModuleShell";
import { RowActions } from "@/components/RowActions";
import {
  api,
  ApiError,
  type Account,
  type BalanceSheet,
  type Bill,
  type CashFlow,
  type Expense,
  type FinancialPeriod,
  type Invoice,
  type JournalEntry,
  type Payment,
  type ProfitAndLoss,
  type TrialBalanceRow,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";
import shared from "@/styles/shared.module.css";

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
  const [cashFlow, setCashFlow] = useState<CashFlow | null>(null);
  const [financialPeriods, setFinancialPeriods] = useState<FinancialPeriod[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [periodForm, setPeriodForm] = useState({ label: "", start_date: "", end_date: "" });
  const [periodWorking, setPeriodWorking] = useState(false);
  const [periodError, setPeriodError] = useState<string | null>(null);

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
      const [acc, je, pay, inv, bil, exp, tb, pl, bs, cf, fp] = await Promise.all([
        api.listAccounts(),
        api.listJournalEntries(),
        api.listPayments(),
        api.listInvoices(),
        api.listBills(),
        api.listExpenses(),
        api.trialBalance(),
        api.profitAndLoss(),
        api.balanceSheet(),
        api.cashFlow(),
        api.listFinancialPeriods(),
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
      setCashFlow(cf);
      setFinancialPeriods(fp);
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

  async function handleCreatePeriod(e: React.FormEvent) {
    e.preventDefault();
    setPeriodWorking(true);
    setPeriodError(null);
    try {
      await api.createFinancialPeriod(periodForm);
      setPeriodForm({ label: "", start_date: "", end_date: "" });
      await loadAll();
    } catch (err) {
      setPeriodError(err instanceof ApiError ? err.message : "Failed to create period.");
    } finally {
      setPeriodWorking(false);
    }
  }

  async function handleClosePeriod(id: number) {
    setPeriodWorking(true);
    setPeriodError(null);
    try {
      await api.closeFinancialPeriod(id);
      await loadAll();
    } catch (err) {
      setPeriodError(err instanceof ApiError ? err.message : "Failed to close period.");
    } finally {
      setPeriodWorking(false);
    }
  }

  if (sessionError) return <main style={{ padding: 40 }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40 }}>Loading…</main>;

  const canManage = activeMembership?.permissions.includes("accounting.manage") ?? false;
  const accountLabel = (id: number) => {
    const a = accounts?.find((acc) => acc.id === id);
    return a ? `${a.code} ${a.name}` : "—";
  };
  const unpaidInvoices = invoices?.filter((i) => i.status !== "paid" && i.status !== "void") ?? [];
  const unpaidBills = bills?.filter((b) => b.status !== "paid" && b.status !== "void") ?? [];
  const payableExpenses = expenses?.filter((e) => e.status === "approved") ?? [];

  return (
    <ModuleShell moduleKey="accounting" activeMembership={activeMembership}>
      <div className={shared.page}>
        <div className={shared.pageHeader}>
          <div>
            <h1 className={shared.pageTitle}>Accounting</h1>
            <p className={shared.pageSubtitle}>{activeMembership?.company.name}</p>
          </div>
        </div>
        {loadError && <p className={shared.errorText}>{loadError}</p>}

        {/* Chart of Accounts */}
        <div className={shared.card} style={{ marginBottom: 24 }}>
          <h2 className={shared.sectionTitle}>Chart of accounts</h2>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {accounts?.map((a) => (
                <tr key={a.id}>
                  <td>{a.code}</td>
                  <td>{a.name}</td>
                  <td>{a.type}</td>
                  {canManage && (
                    <td style={{ textAlign: "right" }}>
                      {a.role ? (
                        <span
                          className={shared.tableMuted}
                          title="A well-known account the posting engine looks up by role — edit/delete disabled to keep auto-posting working."
                        >
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
          {accountError && <p className={shared.errorText}>{accountError}</p>}
          {canManage && (
            <form onSubmit={handleAddAccount} className={shared.formRow} style={{ marginTop: 12 }}>
              <input
                placeholder="Code"
                required
                value={accountForm.code}
                onChange={(e) => setAccountForm({ ...accountForm, code: e.target.value })}
                className={shared.input}
                style={{ width: 100 }}
              />
              <input
                placeholder="Name"
                required
                value={accountForm.name}
                onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                className={shared.input}
                style={{ flex: 1, maxWidth: 240 }}
              />
              <select
                value={accountForm.type}
                onChange={(e) =>
                  setAccountForm({ ...accountForm, type: e.target.value as Account["type"] })
                }
                className={shared.select}
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
                className={`${shared.btn} ${shared.btnPrimary}`}
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
                  className={shared.btn}
                >
                  Cancel
                </button>
              )}
            </form>
          )}
        </div>

          {/* Journal Entries */}
        <div className={shared.card} style={{ marginBottom: 24 }}>
          <h2 className={shared.sectionTitle}>Journal entries</h2>
          <p className={shared.hint} style={{ marginBottom: 8 }}>
            Most of these post automatically (invoices, bills, payments) — this list includes those
            alongside any manual entries below.
          </p>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Memo</th>
                <th>Lines</th>
              </tr>
            </thead>
            <tbody>
              {entries?.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.reference}</td>
                  <td>{entry.memo}</td>
                  <td>
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
                  <td colSpan={3} className={shared.tableMuted}>
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
                  className={shared.input}
                  style={{ flex: 1 }}
                />
                <input
                  placeholder="Memo"
                  value={jeMemo}
                  onChange={(e) => setJeMemo(e.target.value)}
                  className={shared.input}
                  style={{ flex: 1 }}
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
                    className={shared.select}
                    style={{ flex: 2 }}
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
                    className={shared.input}
                    style={{ width: 100 }}
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
                    className={shared.input}
                    style={{ width: 100 }}
                  />
                  <button
                    type="button"
                    onClick={() => setJeLines(jeLines.filter((_, idx) => idx !== i))}
                    disabled={jeLines.length === 2}
                    className={`${shared.btn} ${shared.btnSmall}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setJeLines([...jeLines, { ...EMPTY_JE_LINE }])}
                className={`${shared.btn} ${shared.btnSmall}`}
                style={{ marginTop: 4 }}
              >
                + Add line
              </button>
              <div>
                <button
                  type="submit"
                  disabled={jeWorking}
                  className={`${shared.btn} ${shared.btnPrimary}`}
                  style={{ marginTop: 8 }}
                >
                  Post journal entry
                </button>
              </div>
              {jeError && <p className={shared.errorText}>{jeError}</p>}
            </form>
          )}
        </div>

          {/* Payments */}
        <div className={shared.card} style={{ marginBottom: 24 }}>
          <h2 className={shared.sectionTitle}>Payments</h2>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Direction</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Against</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {payments?.map((p) => (
                <tr key={p.id}>
                  <td>{p.direction}</td>
                  <td>{formatCents(p.amount_cents)}</td>
                  <td>{p.method}</td>
                  <td>{p.reference || "—"}</td>
                  <td>
                    {p.invoice
                      ? invoices?.find((i) => i.id === p.invoice)?.invoice_number
                      : p.bill
                        ? bills?.find((b) => b.id === p.bill)?.bill_number
                        : (() => {
                            const exp = expenses?.find((e) => e.id === p.expense);
                            return exp ? `Expense: ${exp.category}` : "—";
                          })()}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <a href={`/dashboard/accounting/receipts/${p.id}`} target="_blank" rel="noopener noreferrer">
                      Receipt
                    </a>
                  </td>
                </tr>
              ))}
              {payments?.length === 0 && (
                <tr>
                  <td colSpan={6} className={shared.tableMuted}>
                    No payments recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {canManage && (
            <form onSubmit={handleAddPayment} className={shared.formGrid} style={{ marginTop: 12 }}>
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
                className={shared.select}
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
                  className={shared.select}
                >
                  <option value="bill">Supplier bill</option>
                  <option value="expense">Employee expense</option>
                </select>
              )}
              <select
                required
                value={paymentForm.target}
                onChange={(e) => setPaymentForm({ ...paymentForm, target: e.target.value })}
                className={shared.select}
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
                className={shared.input}
              />
              <select
                value={paymentForm.method}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, method: e.target.value as Payment["method"] })
                }
                className={shared.select}
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
                className={shared.input}
              />
              <button
                type="submit"
                disabled={paymentWorking || !paymentForm.target || !paymentForm.amount}
                className={`${shared.btn} ${shared.btnPrimary}`}
                style={{ gridColumn: "1 / -1", justifySelf: "start" }}
              >
                Record payment
              </button>
              {paymentError && (
                <p className={shared.errorText} style={{ gridColumn: "1 / -1", margin: 0 }}>
                  {paymentError}
                </p>
              )}
            </form>
          )}
        </div>

          {/* Reports */}
        <div className={shared.card} style={{ marginBottom: 24 }}>
          <h2 className={shared.sectionTitle}>Reports</h2>

          <h3 style={{ fontSize: 13, fontWeight: 700, marginTop: 16, marginBottom: 4 }}>Trial balance</h3>
          <table className={shared.table}>
            <thead>
              <tr>
                <th>Account</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Net</th>
              </tr>
            </thead>
            <tbody>
              {trialBalance?.map((row) => (
                <tr key={row.account_id}>
                  <td>
                    {row.code} {row.name}
                  </td>
                  <td>{formatCents(row.total_debit_cents)}</td>
                  <td>{formatCents(row.total_credit_cents)}</td>
                  <td>{formatCents(row.net_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", gap: 40, marginTop: 24, flexWrap: "wrap" }}>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700 }}>Profit &amp; loss</h3>
              {profitAndLoss && (
                <table className={shared.table} style={{ width: "auto" }}>
                  <tbody>
                    <tr>
                      <td>Revenue</td>
                      <td style={{ textAlign: "right" }}>
                        {formatCents(profitAndLoss.total_revenue_cents)}
                      </td>
                    </tr>
                    <tr>
                      <td>Expenses</td>
                      <td style={{ textAlign: "right" }}>
                        {formatCents(profitAndLoss.total_expense_cents)}
                      </td>
                    </tr>
                    <tr style={{ fontWeight: 700 }}>
                      <td>Net income</td>
                      <td style={{ textAlign: "right" }}>
                        {formatCents(profitAndLoss.net_income_cents)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>

            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700 }}>Balance sheet</h3>
              {balanceSheet && (
                <table className={shared.table} style={{ width: "auto" }}>
                  <tbody>
                    <tr>
                      <td>Total assets</td>
                      <td style={{ textAlign: "right" }}>
                        {formatCents(balanceSheet.total_assets_cents)}
                      </td>
                    </tr>
                    <tr>
                      <td>Total liabilities</td>
                      <td style={{ textAlign: "right" }}>
                        {formatCents(balanceSheet.total_liabilities_cents)}
                      </td>
                    </tr>
                    <tr>
                      <td>Total equity</td>
                      <td style={{ textAlign: "right" }}>
                        {formatCents(balanceSheet.total_equity_cents)}
                      </td>
                    </tr>
                    <tr>
                      <td>Unclosed net income</td>
                      <td style={{ textAlign: "right" }}>
                        {formatCents(balanceSheet.unclosed_net_income_cents)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
              {balanceSheet && (
                <p className={shared.hint} style={{ maxWidth: 320, marginTop: 8 }}>
                  {balanceSheet.note}
                </p>
              )}
            </div>

            <div>
              <h3 style={{ fontSize: 13, fontWeight: 700 }}>Cash flow</h3>
              {cashFlow && (
                <table className={shared.table} style={{ width: "auto" }}>
                  <tbody>
                    <tr>
                      <td>Received from customers</td>
                      <td style={{ textAlign: "right" }}>
                        {formatCents(cashFlow.cash_received_from_customers_cents)}
                      </td>
                    </tr>
                    <tr>
                      <td>Paid to suppliers</td>
                      <td style={{ textAlign: "right" }}>
                        {formatCents(cashFlow.cash_paid_to_suppliers_cents)}
                      </td>
                    </tr>
                    <tr>
                      <td>Paid to employees</td>
                      <td style={{ textAlign: "right" }}>
                        {formatCents(cashFlow.cash_paid_to_employees_cents)}
                      </td>
                    </tr>
                    {cashFlow.other_cash_movements_cents !== 0 && (
                      <tr>
                        <td>Other cash movements</td>
                        <td style={{ textAlign: "right" }}>
                          {formatCents(cashFlow.other_cash_movements_cents)}
                        </td>
                      </tr>
                    )}
                    <tr style={{ fontWeight: 700 }}>
                      <td>Net change in cash</td>
                      <td style={{ textAlign: "right" }}>
                        {formatCents(cashFlow.net_change_in_cash_cents)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
              {cashFlow && (
                <p className={shared.hint} style={{ maxWidth: 320, marginTop: 8 }}>
                  {cashFlow.note}
                </p>
              )}
            </div>
          </div>
        </div>

          {/* Financial Periods */}
          <section style={{ marginTop: 40, marginBottom: 40 }}>
            <h2 style={{ fontSize: 14, color: "#666", textTransform: "uppercase", letterSpacing: 1 }}>
              Financial periods
            </h2>
            <p style={{ fontSize: 12, color: "#999", maxWidth: 600 }}>
              Closing a period sweeps every Revenue/Expense account&apos;s balance into Retained
              Earnings in one journal entry. Periods must be closed in order, and a closed period
              can&apos;t be reopened.
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid #ddd" }}>
                  <th style={{ padding: "6px 4px" }}>Label</th>
                  <th style={{ padding: "6px 4px" }}>Start</th>
                  <th style={{ padding: "6px 4px" }}>End</th>
                  <th style={{ padding: "6px 4px" }}>Status</th>
                  <th style={{ padding: "6px 4px" }}>Net income</th>
                  {canManage && <th></th>}
                </tr>
              </thead>
              <tbody>
                {financialPeriods?.map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "6px 4px" }}>{p.label}</td>
                    <td style={{ padding: "6px 4px" }}>{p.start_date}</td>
                    <td style={{ padding: "6px 4px" }}>{p.end_date}</td>
                    <td style={{ padding: "6px 4px" }}>
                      <span
                        style={{
                          color: p.status === "closed" ? "#1565c0" : "#2e7d32",
                          fontWeight: 600,
                        }}
                      >
                        {p.status === "closed" ? "Closed" : "Open"}
                      </span>
                    </td>
                    <td style={{ padding: "6px 4px" }}>
                      {p.net_income_cents !== null ? formatCents(p.net_income_cents) : "—"}
                    </td>
                    {canManage && (
                      <td style={{ padding: "6px 4px", textAlign: "right" }}>
                        {p.status === "open" && (
                          <button
                            type="button"
                            disabled={periodWorking}
                            onClick={() => handleClosePeriod(p.id)}
                            style={{ padding: "4px 10px" }}
                          >
                            Close
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {financialPeriods?.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "6px 4px", color: "#999" }}>
                      No financial periods yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {canManage && (
              <form
                onSubmit={handleCreatePeriod}
                style={{
                  marginTop: 16,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 8,
                  maxWidth: 700,
                }}
              >
                <input
                  placeholder="Label (e.g. FY2026 Q1)"
                  required
                  value={periodForm.label}
                  onChange={(e) => setPeriodForm({ ...periodForm, label: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  type="date"
                  required
                  value={periodForm.start_date}
                  onChange={(e) => setPeriodForm({ ...periodForm, start_date: e.target.value })}
                  style={{ padding: 8 }}
                />
                <input
                  type="date"
                  required
                  value={periodForm.end_date}
                  onChange={(e) => setPeriodForm({ ...periodForm, end_date: e.target.value })}
                  style={{ padding: 8 }}
                />
                <button type="submit" disabled={periodWorking || !periodForm.label} style={{ padding: 8 }}>
                  Add period
                </button>
                {periodError && (
                  <p style={{ color: "crimson", gridColumn: "1 / -1", margin: 0 }}>{periodError}</p>
                )}
              </form>
            )}
          </section>

        {/* Links to dedicated accounting tools */}
        <div className={shared.section}>
          <h2 className={shared.sectionTitle}>More accounting tools</h2>
          <div className={shared.pageActions}>
            <Link href="/dashboard/accounting/banking" className={shared.btn}>
              Bank accounts & reconciliation
            </Link>
            <Link href="/dashboard/accounting/petty-cash" className={shared.btn}>
              Petty cash
            </Link>
            <Link href="/dashboard/accounting/budgets" className={shared.btn}>
              Budgets
            </Link>
            <Link href="/dashboard/accounting/fixed-assets" className={shared.btn}>
              Fixed assets
            </Link>
          </div>
        </div>
      </div>
    </ModuleShell>
  );
}
