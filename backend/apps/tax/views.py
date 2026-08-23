from apps.common.views import CompanyScopedViewSet

from .models import TaxRate
from .serializers import TaxRateSerializer


class TaxRateViewSet(CompanyScopedViewSet):
    # Same split as Branch: every member needs settings.view to see the
    # rates (Items need to display/pick one), only settings.manage can
    # add/edit/deactivate one.
    queryset = TaxRate.objects.all()
    serializer_class = TaxRateSerializer
    permission_module = "settings"
