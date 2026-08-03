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

from .models import Account


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
