from apps.common.serializers import CompanyScopedSerializer

from .models import TaxRate


class TaxRateSerializer(CompanyScopedSerializer):
    class Meta:
        model = TaxRate
        fields = ["id", "name", "code", "rate_percent", "is_default", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]
