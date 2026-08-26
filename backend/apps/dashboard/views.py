"""One summary endpoint for the whole company overview, rather than a
dashboard app owning its own copies of finance/sales/inventory/hr
logic. Each section is included only if the requesting user has that
section's *own* module permission — same permission model as
everywhere else, just checked four times instead of once, since no
single permission covers "the whole dashboard". A user with only one
module's access still gets a (smaller) dashboard, not a 403.
"""

from datetime import timedelta

from django.db.models import Count, F, Sum
from django.utils import timezone
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounting.models import Account
from apps.accounting.reports import _account_totals
from apps.common.permissions import user_has_permission
from apps.hotel.models import FolioCharge, GuestFolio, Reservation, Room, RoomStatusLog
from apps.housekeeping.models import HousekeepingTask
from apps.hr.models import Employee
from apps.inventory.models import Stock
from apps.catalog.models import Item
from apps.procurement.models import Bill
from apps.sales.models import Invoice, SalesOrder

# Human labels for the room-status-change events shown in the "recent
# activity" feed — RoomStatusLog already records exactly the moments a
# hotel dashboard cares about (a room going occupied *is* a check-in,
# going dirty *is* a check-out), so no separate activity-log model is
# needed for this.
_ACTIVITY_LABELS = {
    Room.Status.OCCUPIED: "Check-in",
    Room.Status.DIRTY: "Check-out",
    Room.Status.CLEAN: "Housekeeping",
    Room.Status.INSPECTED: "Inspection",
    Room.Status.AVAILABLE: "Room available",
    Room.Status.OUT_OF_ORDER: "Out of order",
    Room.Status.MAINTENANCE: "Maintenance",
}


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

        if user_has_permission(request.user, company, "hotel", "view"):
            today = timezone.localdate()
            month_start = today.replace(day=1)
            # First of next month, without a calendar import: step forward a
            # few days past any month-end then re-truncate to day 1.
            next_month_start = (month_start + timedelta(days=32)).replace(day=1)

            room_qs = Room.objects.filter(company=company)
            room_count = room_qs.count()
            status_counts = {row["status"]: row["count"] for row in room_qs.values("status").annotate(count=Count("id"))}
            occupied_count = status_counts.get(Room.Status.OCCUPIED, 0)

            reservations = Reservation.objects.filter(company=company).exclude(
                status__in=[Reservation.Status.CANCELLED, Reservation.Status.NO_SHOW]
            )
            today_arrivals = reservations.filter(check_in_date=today).count()
            today_departures = reservations.filter(check_out_date=today).count()

            # Room revenue isn't posted as a FolioCharge (see FolioChargeViewSet
            # docstring — only ancillary spend is), so it's derived here from
            # the nightly rate for every night a reservation occupies this
            # month; every other department comes straight from real charges.
            revenue_by_department = {choice.value: 0 for choice in FolioCharge.SourceModule}
            room_revenue_cents = 0
            for res in reservations.filter(
                check_in_date__lt=next_month_start,
                check_out_date__gt=month_start,
            ).only("check_in_date", "check_out_date", "rate_cents"):
                nights_this_month = (min(res.check_out_date, today) - max(res.check_in_date, month_start)).days
                if nights_this_month > 0:
                    room_revenue_cents += nights_this_month * res.rate_cents
            revenue_by_department[FolioCharge.SourceModule.ROOM] = room_revenue_cents

            for row in (
                FolioCharge.objects.filter(company=company, created_at__date__gte=month_start)
                .values("source_module")
                .annotate(total=Sum("amount_cents"))
            ):
                revenue_by_department[row["source_module"]] = (
                    revenue_by_department.get(row["source_module"], 0) + row["total"]
                )

            todays_room_revenue = sum(
                res.rate_cents
                for res in reservations.filter(
                    status=Reservation.Status.CHECKED_IN, check_in_date__lte=today, check_out_date__gt=today
                ).only("rate_cents")
            )
            todays_other_revenue = (
                FolioCharge.objects.filter(company=company, created_at__date=today).aggregate(
                    total=Sum("amount_cents")
                )["total"]
                or 0
            )
            revpar_cents = (todays_room_revenue + todays_other_revenue) // room_count if room_count else 0

            pending_folio_count = sum(
                1
                for folio in GuestFolio.objects.filter(company=company, status=GuestFolio.Status.OPEN).prefetch_related(
                    "charges"
                )
                if folio.balance_cents > 0
            )

            recent_activity = [
                {
                    "label": _ACTIVITY_LABELS.get(log.status, log.get_status_display()),
                    "room_number": log.room.number,
                    "changed_by_name": log.changed_by.full_name if log.changed_by else None,
                    "created_at": log.created_at,
                }
                for log in RoomStatusLog.objects.filter(company=company)
                .select_related("room", "changed_by")
                .order_by("-created_at")[:8]
            ]

            data["hotel"] = {
                "room_count": room_count,
                "occupied_count": occupied_count,
                "occupancy_pct": round(occupied_count / room_count * 100, 1) if room_count else 0,
                "room_status_counts": status_counts,
                "today_arrivals": today_arrivals,
                "today_departures": today_departures,
                "revenue_by_department_cents": revenue_by_department,
                "revpar_cents": revpar_cents,
                "pending_folio_count": pending_folio_count,
                "recent_activity": recent_activity,
            }

        if user_has_permission(request.user, company, "housekeeping", "view"):
            tasks = HousekeepingTask.objects.filter(company=company)
            data["housekeeping"] = {
                "rooms_to_clean": tasks.filter(
                    task_type=HousekeepingTask.TaskType.CLEANING, status=HousekeepingTask.Status.PENDING
                ).count(),
                "currently_cleaning": tasks.filter(
                    task_type=HousekeepingTask.TaskType.CLEANING, status=HousekeepingTask.Status.IN_PROGRESS
                ).count(),
                "inspections_due": tasks.filter(
                    task_type=HousekeepingTask.TaskType.INSPECTION, status=HousekeepingTask.Status.PENDING
                ).count(),
                "out_of_service": Room.objects.filter(
                    company=company, status=Room.Status.OUT_OF_ORDER
                ).count(),
            }

        return Response(data)
