from apps.common.views import CompanyScopedViewSet

from .models import Supplier
from .serializers import SupplierSerializer


class SupplierViewSet(CompanyScopedViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_module = "procurement"
