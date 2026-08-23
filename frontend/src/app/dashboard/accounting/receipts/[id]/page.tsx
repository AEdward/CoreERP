"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  api,
  ApiError,
  type Bill,
  type EmployeePickerEntry,
  type Expense,
  type Invoice,
  type Payment,
} from "@/lib/api";
import { useSession } from "@/lib/useSession";

function formatCents(cents: number) {
  return (cents / 100).toFixed(2);
}

const METHOD_LABELS: Record<Payment["method"], string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  mobile_money: "Mobile money",
  card: "Card",
};

/** A single printable receipt for one Payment — deliberately just a
 * clean HTML page with a Print button (window.print()), not a generated
 * PDF: the browser's own print-to-PDF already covers "save as a file"
 * without adding a PDF library this project doesn't otherwise need. */
export default function ReceiptPage() {
  const params = useParams<{ id: string }>();
  const { me, activeMembership, error: sessionError } = useSession();

  const [payment, setPayment] = useState<Payment | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [employees, setEmployees] = useState<EmployeePickerEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeMembership) return;
    (async () => {
      try {
        const [p, inv, bil, exp, emp] = await Promise.all([
          api.getPayment(Number(params.id)),
          api.listInvoices(),
          api.listBills(),
          api.listExpenses(),
          api.listEmployeePicker(),
        ]);
        setPayment(p);
        setInvoices(inv);
        setBills(bil);
        setExpenses(exp);
        setEmployees(emp);
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Failed to load receipt.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembership?.company.id, params.id]);

  if (sessionError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{sessionError}</main>;
  if (!me) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;
  if (!activeMembership) {
    return (
      <main style={{ padding: 40, fontFamily: "sans-serif" }}>
        <p style={{ color: "#666" }}>
          Pick an active company on the <a href="/dashboard">dashboard</a> first.
        </p>
      </main>
    );
  }
  if (loadError) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>{loadError}</main>;
  if (!payment) return <main style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</main>;

  const against = payment.invoice
    ? `Invoice ${invoices?.find((i) => i.id === payment.invoice)?.invoice_number ?? "—"}`
    : payment.bill
      ? `Bill ${bills?.find((b) => b.id === payment.bill)?.bill_number ?? "—"}`
      : (() => {
          const exp = expenses?.find((e) => e.id === payment.expense);
          if (!exp) return "—";
          const employeeName = employees?.find((e) => e.id === exp.employee)?.name ?? "—";
          return `Expense claim — ${exp.category} (${employeeName})`;
        })();

  return (
    <main style={{ maxWidth: 640, margin: "40px auto", fontFamily: "sans-serif", padding: "0 16px" }}>
      <style>{"@media print { .no-print { display: none; } }"}</style>

      <div className="no-print" style={{ marginBottom: 24, display: "flex", justifyContent: "space-between" }}>
        <a href="/dashboard/accounting">← Back to Accounting</a>
        <button onClick={() => window.print()} style={{ padding: "6px 16px" }}>
          Print
        </button>
      </div>

      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1 style={{ fontSize: 20, margin: 0 }}>{activeMembership.company.name}</h1>
            {activeMembership.company.address && (
              <p style={{ color: "#666", fontSize: 13, margin: "4px 0 0" }}>
                {activeMembership.company.address}
              </p>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <h2 style={{ fontSize: 16, margin: 0 }}>RECEIPT</h2>
            <p style={{ fontSize: 13, color: "#666", margin: "4px 0 0" }}>
              {payment.receipt_number || `#${payment.id}`}
            </p>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 32, fontSize: 14 }}>
          <tbody>
            <tr>
              <td style={{ padding: "6px 12px 6px 0", color: "#666" }}>Date</td>
              <td style={{ padding: "6px 0" }}>{new Date(payment.created_at).toLocaleDateString()}</td>
            </tr>
            <tr>
              <td style={{ padding: "6px 12px 6px 0", color: "#666" }}>
                {payment.direction === "received" ? "Received from" : "Paid to"}
              </td>
              <td style={{ padding: "6px 0" }}>{against}</td>
            </tr>
            <tr>
              <td style={{ padding: "6px 12px 6px 0", color: "#666" }}>Method</td>
              <td style={{ padding: "6px 0" }}>{METHOD_LABELS[payment.method]}</td>
            </tr>
            {payment.reference && (
              <tr>
                <td style={{ padding: "6px 12px 6px 0", color: "#666" }}>Reference</td>
                <td style={{ padding: "6px 0" }}>{payment.reference}</td>
              </tr>
            )}
            <tr style={{ borderTop: "2px solid #ddd", fontWeight: 700, fontSize: 16 }}>
              <td style={{ padding: "12px 12px 0 0" }}>Amount</td>
              <td style={{ padding: "12px 0 0" }}>
                {activeMembership.company.currency} {formatCents(payment.amount_cents)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  );
}
