"""Read-only reports computed from journal_lines — no separate summary
tables to keep in sync, just aggregation over the ledger. Explicitly
the "stretch goal" scope from docs/ARCHITECTURE.md §6: correct, simple,
no date-range filtering yet (all-time totals only).
"""

from django.db.models import Sum
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import user_has_permission

from .models import Account, JournalLine, Payment


class AccountingReportView(APIView):
    """Same company/permission guard as CompanyScopedMixin, reimplemented
    here because these aren't CRUD resources so don't fit a ModelViewSet."""

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not request.company:
            raise NotFound("Select an active company first (POST /api/companies/active/).")
        if not user_has_permission(request.user, request.company, "accounting", "view"):
            raise PermissionDenied("You don't have permission to view accounting reports.")


def _account_totals(company):
    """One query: every account with its summed debit/credit activity."""
    return Account.objects.filter(company=company).annotate(
        total_debit=Sum("journal_lines__debit_cents"),
        total_credit=Sum("journal_lines__credit_cents"),
    )


class TrialBalanceView(AccountingReportView):
    def get(self, request):
        rows = []
        for account in _account_totals(request.company):
            debit = account.total_debit or 0
            credit = account.total_credit or 0
            rows.append(
                {
                    "account_id": account.id,
                    "code": account.code,
                    "name": account.name,
                    "type": account.type,
                    "total_debit_cents": debit,
                    "total_credit_cents": credit,
                    "net_cents": debit - credit,
                }
            )
        return Response(rows)


class ProfitAndLossView(AccountingReportView):
    def get(self, request):
        revenue_lines, expense_lines = [], []
        total_revenue = total_expense = 0
        for account in _account_totals(request.company):
            debit = account.total_debit or 0
            credit = account.total_credit or 0
            if account.type == Account.Type.REVENUE:
                amount = credit - debit
                total_revenue += amount
                revenue_lines.append({"code": account.code, "name": account.name, "amount_cents": amount})
            elif account.type == Account.Type.EXPENSE:
                amount = debit - credit
                total_expense += amount
                expense_lines.append({"code": account.code, "name": account.name, "amount_cents": amount})

        return Response(
            {
                "revenue": revenue_lines,
                "total_revenue_cents": total_revenue,
                "expenses": expense_lines,
                "total_expense_cents": total_expense,
                "net_income_cents": total_revenue - total_expense,
            }
        )


class BalanceSheetView(AccountingReportView):
    def get(self, request):
        asset_lines, liability_lines, equity_lines = [], [], []
        total_assets = total_liabilities = total_equity = 0
        total_revenue = total_expense = 0

        for account in _account_totals(request.company):
            debit = account.total_debit or 0
            credit = account.total_credit or 0
            if account.type == Account.Type.ASSET:
                amount = debit - credit
                total_assets += amount
                asset_lines.append({"code": account.code, "name": account.name, "amount_cents": amount})
            elif account.type == Account.Type.LIABILITY:
                amount = credit - debit
                total_liabilities += amount
                liability_lines.append({"code": account.code, "name": account.name, "amount_cents": amount})
            elif account.type == Account.Type.EQUITY:
                amount = credit - debit
                total_equity += amount
                equity_lines.append({"code": account.code, "name": account.name, "amount_cents": amount})
            elif account.type == Account.Type.REVENUE:
                total_revenue += credit - debit
            elif account.type == Account.Type.EXPENSE:
                total_expense += debit - credit

        net_income = total_revenue - total_expense

        return Response(
            {
                "assets": asset_lines,
                "total_assets_cents": total_assets,
                "liabilities": liability_lines,
                "total_liabilities_cents": total_liabilities,
                "equity": equity_lines,
                "total_equity_cents": total_equity,
                "retained_earnings_current_period_cents": net_income,
                "note": (
                    "retained_earnings_current_period_cents is the current period's net income, "
                    "not yet folded into a real Retained Earnings account — there's no period-close "
                    "mechanism yet. Assets = Liabilities + Equity + this figure, not Liabilities + "
                    "Equity alone."
                ),
            }
        )


class CashFlowView(AccountingReportView):
    """Direct method, sourced from the Cash-role account's own journal
    lines — not just Payment records — so nothing is missed if cash ever
    moves through a manual Journal Entry (an opening balance, say)
    rather than through Payment. The Payment-derived categories are a
    human-readable breakdown of that same total, not a second source of
    truth: any cash movement Payment doesn't account for shows up
    honestly as `other_cash_movements_cents` instead of being silently
    dropped.

    Deliberately Operating-only, not the conventional three-section
    Operating/Investing/Financing statement: nothing in CoreERP yet
    generates an Investing or Financing cash movement (no Fixed Assets,
    no loans, no equity contributions/draws), and a statement with two
    permanently-empty sections would be more misleading than a single
    section that's actually always accurate.
    """

    def get(self, request):
        company = request.company

        cash_lines = JournalLine.objects.filter(company=company, account__role=Account.Role.CASH)
        total_cash_in = 0
        total_cash_out = 0
        for line in cash_lines:
            total_cash_in += line.debit_cents
            total_cash_out += line.credit_cents

        payments = Payment.objects.filter(company=company)
        received_from_customers = sum(
            p.amount_cents for p in payments if p.direction == Payment.Direction.RECEIVED
        )
        paid_to_suppliers = sum(
            p.amount_cents for p in payments if p.direction == Payment.Direction.PAID and p.bill_id
        )
        paid_to_employees = sum(
            p.amount_cents for p in payments if p.direction == Payment.Direction.PAID and p.expense_id
        )

        other_cash_movements = (total_cash_in - received_from_customers) - (
            total_cash_out - paid_to_suppliers - paid_to_employees
        )

        return Response(
            {
                "cash_received_from_customers_cents": received_from_customers,
                "cash_paid_to_suppliers_cents": paid_to_suppliers,
                "cash_paid_to_employees_cents": paid_to_employees,
                "other_cash_movements_cents": other_cash_movements,
                "net_change_in_cash_cents": total_cash_in - total_cash_out,
                "note": (
                    "Direct method, all-time (no date range yet, same limitation as the other "
                    "reports). Operating activities only — CoreERP doesn't yet model Investing or "
                    "Financing cash movements (Fixed Assets, loans, equity), so those sections "
                    "aren't included rather than shown as permanently empty. "
                    "other_cash_movements_cents captures anything touching the Cash account that "
                    "didn't come through a recorded Payment, e.g. a manual journal entry."
                ),
            }
        )
