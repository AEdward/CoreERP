from django.db import connection, transaction
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Item
from apps.companies.models import Company

from .models import Table


class PublicMenuView(APIView):
    """A QR code on a restaurant/bar table links here — no login, no
    company membership, because there isn't one: nobody's authenticated
    yet when they're just looking at a menu. Every other tenant table in
    this codebase relies on RLS's "companies this user is a member of"
    check (see apps.common.rls), which an anonymous request satisfies for
    nothing — so this view explicitly runs inside the same SET LOCAL
    app.is_platform_admin bypass the retroactive seed migrations already
    use for legitimate system-level access, then immediately narrows back
    down to exactly one company's active, menu-flagged product items.
    Nothing else about the company (financials, other items, staff) is
    reachable through this endpoint.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        company_id = request.query_params.get("company")
        table_id = request.query_params.get("table")
        if not company_id:
            raise NotFound("A company is required.")

        with transaction.atomic():
            with connection.cursor() as cursor:
                cursor.execute("SET LOCAL app.is_platform_admin = 'true'")

            company = Company.objects.filter(id=company_id).first()
            if not company:
                raise NotFound("Menu not found.")

            table = None
            if table_id:
                table = Table.objects.filter(id=table_id, company_id=company_id).first()

            items = Item.objects.filter(
                company_id=company_id,
                type=Item.Type.PRODUCT,
                status=Item.Status.ACTIVE,
                show_on_menu=True,
            ).order_by("category", "name")

            data = {
                "company_name": company.name,
                "table_name": table.name if table else None,
                "items": [
                    {
                        "id": item.id,
                        "name": item.name,
                        "description": item.description,
                        "category": item.category,
                        "price_cents": item.price_cents,
                    }
                    for item in items
                ],
            }

        return Response(data)
