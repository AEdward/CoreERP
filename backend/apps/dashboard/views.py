"""One summary endpoint for the whole company overview, rather than a
dashboard app owning its own copies of finance/sales/inventory/hr
logic. Each section is included only if the requesting user has that
section's *own* module permission — same permission model as
everywhere else, just checked four times instead of once, since no
single permission covers "the whole dashboard". A user with only one
module's access still gets a (smaller) dashboard, not a 403.
"""

from django.db.models import F, Sum
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounting.models import Account
from apps.accounting.reports import _account_totals
from apps.common.permissions import user_has_permission
from apps.hr.models import Employee
from apps.inventory.models import Stock
from apps.catalog.models import Item
from apps.procurement.models import Bill
from apps.sales.models import Invoice, SalesOrder


class CompanySummaryView(APIView):
    def get(self, request):
        company = request.company
        if not company:
            raise NotFound("Select an active company first (POST /api/companies/active/).")

        data = {}

        if user_has_permission(request.user, company, "accounting", "view"):
            total_revenue = total_expense = 0
            for account in _account_totals(company):
                debit = account.total_debit or 0
                credit = account.total_credit or 0
                if account.type == Account.Type.REVENUE:
                    total_revenue += credit - debit
                elif account.type == Account.Type.EXPENSE:
                    total_expense += debit - credit

            pending_receivable = (
                Invoice.objects.filter(company=company)
                .exclude(status__in=[Invoice.Status.PAID, Invoice.Status.VOID])
                .aggregate(total=Sum("amount_cents"), tax=Sum("tax_amount_cents"))
            )
            pending_payable = (
                Bill.objects.filter(company=company)
                .exclude(status__in=[Bill.Status.PAID, Bill.Status.VOID])
                .aggregate(total=Sum("amount_cents"), tax=Sum("tax_amount_cents"))
            )

            data["finance"] = {
                "revenue_cents": total_revenue,
                "expense_cents": total_expense,
                "profit_cents": total_revenue - total_expense,
                "pending_receivable_cents": (pending_receivable["total"] or 0)
                + (pending_receivable["tax"] or 0),
                "pending_payable_cents": (pending_payable["total"] or 0) + (pending_payable["tax"] or 0),
            }

        if user_has_permission(request.user, company, "sales", "view"):
            orders = SalesOrder.objects.filter(company=company).prefetch_related("lines")
            data["sales"] = {
                "order_count": orders.count(),
                # total_cents is a Python property (sums line totals), not a
                # DB column, so this can't be a queryset .aggregate(Sum(...))
                # — fine at MVP scale, same tradeoff as the reports below.
                "total_sales_cents": sum(order.total_cents for order in orders),
            }

        if user_has_permission(request.user, company, "inventory", "view"):
            stock_qs = Stock.objects.filter(company=company)
            data["inventory"] = {
                "item_count": Item.objects.filter(company=company).count(),
                "total_units": stock_qs.aggregate(total=Sum("quantity"))["total"] or 0,
                "low_stock_count": stock_qs.filter(quantity__lte=F("minimum_stock")).count(),
            }

        if user_has_permission(request.user, company, "hr", "view"):
            data["hr"] = {
                "employee_count": Employee.objects.filter(
                    company=company, status=Employee.Status.ACTIVE
                ).count(),
            }

        return Response(data)
