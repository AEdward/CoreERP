from apps.common.views import CompanyScopedViewSet

from .models import Expense
from .serializers import ExpenseSerializer


class ExpenseViewSet(CompanyScopedViewSet):
    queryset = Expense.objects.select_related("employee")
    serializer_class = ExpenseSerializer
    permission_module = "expenses"
