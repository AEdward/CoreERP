from rest_framework.exceptions import NotFound, PermissionDenied

from apps.common.permissions import user_has_permission
from apps.common.views import CompanyScopedMixin, CompanyScopedViewSet

from .models import Item
from .serializers import ItemSerializer


class ItemViewSet(CompanyScopedViewSet):
    """Items are inventory master data (cost/price live here), but Sales
    needs to read them too (to build quotations/orders) — the one case in
    Phase 2 where a single permission_module isn't enough, so this
    overrides `initial` instead of using CompanyScopedViewSet's default
    single-module check.
    """

    queryset = Item.objects.all()
    serializer_class = ItemSerializer
    permission_module = "inventory"

    def initial(self, request, *args, **kwargs):
        # Skip CompanyScopedMixin.initial's single-module check — this
        # calls up to ModelViewSet/APIView directly for the standard
        # authentication/negotiation/throttling setup, then applies its
        # own OR-of-two-modules rule below instead.
        super(CompanyScopedMixin, self).initial(request, *args, **kwargs)
        if not request.company:
            raise NotFound("Select an active company first (POST /api/companies/active/).")

        if self.action in ("list", "retrieve"):
            allowed = user_has_permission(
                request.user, request.company, "inventory", "view"
            ) or user_has_permission(request.user, request.company, "sales", "view")
        else:
            allowed = user_has_permission(request.user, request.company, "inventory", "manage")

        if not allowed:
            raise PermissionDenied("You don't have permission to do that with the item catalog.")
