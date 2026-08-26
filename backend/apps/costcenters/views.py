from apps.common.views import CompanyScopedViewSet

from .models import CostCenter
from .serializers import CostCenterSerializer


class CostCenterViewSet(CompanyScopedViewSet):
    queryset = CostCenter.objects.all()
    serializer_class = CostCenterSerializer
    # Same split as apps.branches.BranchViewSet: every member needs
    # settings.view to see the list and assign records to one; only
    # settings.manage can add/rename/remove a cost center itself.
    permission_module = "settings"
