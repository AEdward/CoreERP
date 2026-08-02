from apps.common.serializers import CompanyScopedSerializer

from .models import Item


class ItemSerializer(CompanyScopedSerializer):
    class Meta:
        model = Item
        fields = [
            "id",
            "type",
            "name",
            "category",
            "price_cents",
            "cost_cents",
            "tax_rate",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]
