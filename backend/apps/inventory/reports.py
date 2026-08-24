"""Closes the module map's "(partial) Reorder Levels" gap: Stock.minimum_stock
already exists and the dashboard already shows a low-stock count, but nothing
suggested what to actually reorder. This is deliberately a simple "top back up
to minimum_stock" suggestion, not a real reorder-point/EOQ system — the same
"correct and simple over sophisticated" scope every other report in this
project takes (see apps.accounting.reports's own docstring).
"""

from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import user_has_permission

from .models import Stock


class ReorderSuggestionsView(APIView):
    """Same company/permission guard as CompanyScopedMixin, reimplemented
    here because this isn't a CRUD resource so doesn't fit a ModelViewSet."""

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not request.company:
            raise NotFound("Select an active company first (POST /api/companies/active/).")
        if not user_has_permission(request.user, request.company, "inventory", "view"):
            raise PermissionDenied("You don't have permission to view inventory reports.")

    def get(self, request):
        rows = []
        stock_rows = (
            Stock.objects.filter(company=request.company, minimum_stock__gt=0)
            .select_related("item", "warehouse")
        )
        for s in stock_rows:
            if s.quantity <= s.minimum_stock:
                rows.append(
                    {
                        "item_id": s.item_id,
                        "item_name": s.item.name,
                        "warehouse_id": s.warehouse_id,
                        "warehouse_name": s.warehouse.name,
                        "quantity": s.quantity,
                        "minimum_stock": s.minimum_stock,
                        "suggested_quantity": s.minimum_stock - s.quantity,
                    }
                )
        return Response(rows)
