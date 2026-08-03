from apps.common.serializers import CompanyScopedSerializer

from .models import Branch


class BranchSerializer(CompanyScopedSerializer):
    class Meta:
        model = Branch
        fields = ["id", "name", "code", "address", "phone", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]
