from django.db import transaction
from rest_framework import serializers

from apps.common.serializers import CompanyScopedSerializer
from apps.notifications.services import notify_permission

from .models import Stock, StockMovement, Warehouse


class WarehouseSerializer(CompanyScopedSerializer):
    same_company_fields = ["branch"]

    class Meta:
        model = Warehouse
        fields = ["id", "name", "location", "branch", "created_at"]
        read_only_fields = ["id", "created_at"]


class StockSerializer(CompanyScopedSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = Stock
        fields = [
            "id",
            "item",
            "item_name",
            "warehouse",
            "warehouse_name",
            "quantity",
            "minimum_stock",
            "created_at",
        ]
        read_only_fields = fields


class StockMovementSerializer(CompanyScopedSerializer):
    same_company_fields = ["item", "warehouse", "to_warehouse"]

    class Meta:
        model = StockMovement
        fields = ["id", "item", "warehouse", "to_warehouse", "type", "quantity", "reference", "created_at"]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        movement_type = attrs.get("type")
        quantity = attrs.get("quantity")
        to_warehouse = attrs.get("to_warehouse")
        warehouse = attrs.get("warehouse")

        if movement_type == StockMovement.MovementType.ADJUSTMENT:
            if not quantity:
                raise serializers.ValidationError({"quantity": "Adjustment quantity can't be zero."})
        elif quantity is None or quantity <= 0:
            raise serializers.ValidationError(
                {"quantity": "Quantity must be positive for this movement type."}
            )

        if movement_type == StockMovement.MovementType.TRANSFER:
            if not to_warehouse:
                raise serializers.ValidationError({"to_warehouse": "Required for a transfer."})
            if warehouse and to_warehouse.id == warehouse.id:
                raise serializers.ValidationError(
                    {"to_warehouse": "Must differ from the source warehouse."}
                )
        elif to_warehouse:
            raise serializers.ValidationError({"to_warehouse": "Only used for transfer movements."})

        return attrs

    def create(self, validated_data):
        with transaction.atomic():
            movement = StockMovement.objects.create(**validated_data)
            company = movement.company

            stock, _ = Stock.objects.select_for_update().get_or_create(
                company=company,
                item=movement.item,
                warehouse=movement.warehouse,
                defaults={"quantity": 0},
            )
            was_above_minimum = stock.quantity > stock.minimum_stock

            if movement.type == StockMovement.MovementType.IN:
                stock.quantity += movement.quantity
            elif movement.type == StockMovement.MovementType.OUT:
                if stock.quantity < movement.quantity:
                    raise serializers.ValidationError({"quantity": "Not enough stock to remove."})
                stock.quantity -= movement.quantity
            elif movement.type == StockMovement.MovementType.ADJUSTMENT:
                stock.quantity += movement.quantity
                if stock.quantity < 0:
                    raise serializers.ValidationError({"quantity": "Adjustment would make stock negative."})
            elif movement.type == StockMovement.MovementType.TRANSFER:
                if stock.quantity < movement.quantity:
                    raise serializers.ValidationError({"quantity": "Not enough stock to transfer."})
                stock.quantity -= movement.quantity
                dest_stock, _ = Stock.objects.select_for_update().get_or_create(
                    company=company,
                    item=movement.item,
                    warehouse=movement.to_warehouse,
                    defaults={"quantity": 0},
                )
                dest_stock.quantity += movement.quantity
                dest_stock.save(update_fields=["quantity"])

            stock.save(update_fields=["quantity"])

            # Only notify on the movement that actually crosses into
            # shortage, not every subsequent movement while already below
            # minimum — otherwise every later OUT/ADJUSTMENT re-alerts.
            if was_above_minimum and stock.quantity <= stock.minimum_stock:
                notify_permission(
                    company,
                    "inventory",
                    "manage",
                    f"Low stock: {movement.item.name} at {movement.warehouse.name} "
                    f"({stock.quantity} left, minimum {stock.minimum_stock})",
                    link="/dashboard/inventory",
                )
        return movement
