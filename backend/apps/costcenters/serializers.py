from apps.common.serializers import CompanyScopedSerializer

from .models import CostCenter


class CostCenterSerializer(CompanyScopedSerializer):
    class Meta:
        model = CostCenter
        fields = ["id", "name", "code", "description", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]
