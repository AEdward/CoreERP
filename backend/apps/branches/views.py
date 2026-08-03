from apps.common.views import CompanyScopedViewSet

from .models import Branch
from .serializers import BranchSerializer


class BranchViewSet(CompanyScopedViewSet):
    queryset = Branch.objects.all()
    serializer_class = BranchSerializer
    # Every member needs settings.view to see the branch list and assign
    # records to one; only settings.manage (Owner, by default) can add,
    # rename, or remove a branch itself.
    permission_module = "settings"
