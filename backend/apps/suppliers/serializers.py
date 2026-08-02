from apps.common.serializers import CompanyScopedSerializer

from .models import Supplier


class SupplierSerializer(CompanyScopedSerializer):
    class Meta:
        model = Supplier
        fields = ["id", "name", "phone", "email", "address", "tax_number", "created_at"]
        read_only_fields = ["id", "created_at"]
