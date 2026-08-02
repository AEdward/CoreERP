from apps.common.serializers import CompanyScopedSerializer

from .models import Customer


class CustomerSerializer(CompanyScopedSerializer):
    class Meta:
        model = Customer
        fields = ["id", "name", "phone", "email", "type", "address", "created_at"]
        read_only_fields = ["id", "created_at"]
