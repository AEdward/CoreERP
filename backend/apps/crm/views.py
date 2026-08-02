from apps.common.views import CompanyScopedViewSet

from .models import Customer
from .serializers import CustomerSerializer


class CustomerViewSet(CompanyScopedViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_module = "sales"
