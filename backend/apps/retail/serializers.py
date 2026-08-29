from django.db import transaction
from rest_framework import serializers

from apps.auditlog.models import AuditLog
from apps.auditlog.services import log_audit
from apps.common.numbering import next_number
from apps.common.serializers import CompanyScopedSerializer
from apps.inventory.models import StockMovement
from apps.inventory.serializers import StockMovementSerializer
from apps.tax.engine import compute_line_tax_cents

from .models import (
    CashierShift,
    GiftCard,
    GiftCardTransaction,
    ProductVariant,
    Promotion,
    Register,
    RetailReturn,
    RetailReturnLine,
    RetailSale,
    RetailSaleLine,
)


class RegisterSerializer(CompanyScopedSerializer):
    same_company_fields = ["branch"]
    branch_name = serializers.CharField(source="branch.name", read_only=True, default="")

    class Meta:
        model = Register
        fields = ["id", "branch", "branch_name", "name", "code", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


class CashierShiftSerializer(CompanyScopedSerializer):
    same_company_fields = ["register"]
    register_name = serializers.CharField(source="register.name", read_only=True)
    cashier_name = serializers.SerializerMethodField()

    class Meta:
        model = CashierShift
        fields = [
            "id",
            "register",
            "register_name",
            "cashier",
            "cashier_name",
            "opening_float_cents",
            "closing_amount_cents",
            "status",
            "closed_at",
            "created_at",
        ]
        read_only_fields = ["id", "cashier", "closing_amount_cents", "status", "closed_at", "created_at"]

    def get_cashier_name(self, obj):
        return obj.cashier.full_name if obj.cashier_id else ""

    def validate(self, attrs):
        register = attrs.get("register")
        if register and CashierShift.objects.filter(register=register, status=CashierShift.Status.OPEN).exists():
            raise serializers.ValidationError({"register": "This register already has an open shift."})
        return super().validate(attrs)

    def create(self, validated_data):
        request = self.context.get("request")
        validated_data["cashier"] = getattr(request, "user", None)
        return super().create(validated_data)


class ProductVariantSerializer(CompanyScopedSerializer):
    same_company_fields = ["item"]
    item_name = serializers.CharField(source="item.name", read_only=True)

    class Meta:
        model = ProductVariant
        fields = ["id", "item", "item_name", "name", "sku", "barcode", "price_cents", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


class PromotionSerializer(CompanyScopedSerializer):
    class Meta:
        model = Promotion
        fields = [
            "id",
            "name",
            "code",
            "discount_type",
            "discount_value",
            "start_date",
            "end_date",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class RetailSaleLineSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    variant_name = serializers.CharField(source="variant.name", read_only=True, default="")
    line_total_cents = serializers.IntegerField(read_only=True)

    class Meta:
        model = RetailSaleLine
        fields = [
            "id",
            "item",
            "item_name",
            "variant",
            "variant_name",
            "quantity",
            "unit_price_cents",
            "discount_percent",
            "line_total_cents",
        ]
        read_only_fields = ["id"]


class RetailSaleSerializer(CompanyScopedSerializer):
    same_company_fields = ["register", "shift", "warehouse", "customer", "promotion"]
    register_name = serializers.CharField(source="register.name", read_only=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True, default="")
    cashier_name = serializers.SerializerMethodField()
    promotion_name = serializers.CharField(source="promotion.name", read_only=True, default="")
    lines = RetailSaleLineSerializer(many=True)

    class Meta:
        model = RetailSale
        fields = [
            "id",
            "number",
            "register",
            "register_name",
            "shift",
            "warehouse",
            "customer",
            "customer_name",
            "cashier",
            "cashier_name",
            "promotion",
            "promotion_name",
            "payment_method",
            "subtotal_cents",
            "discount_cents",
            "tax_cents",
            "total_cents",
            "status",
            "lines",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "number",
            "cashier",
            "subtotal_cents",
            "discount_cents",
            "tax_cents",
            "total_cents",
            "status",
            "created_at",
        ]

    def get_cashier_name(self, obj):
        return obj.cashier.full_name if obj.cashier_id else ""

    def validate_lines(self, lines):
        if not lines:
            raise serializers.ValidationError("At least one line item is required.")
        return lines

    def create(self, validated_data):
        """Checkout. subtotal_cents is the sum of each line's
        line_total_cents (gross minus that line's own discount_percent)
        — post line-discount, pre-promotion. discount_cents is the
        header Promotion's cut of that subtotal (0 if none picked).
        tax_cents runs the shared apps.tax.engine over the same lines
        (each already net of its own line discount) — the promotion
        discount is applied after tax, the same order many real
        registers use for a coupon/loyalty discount. total_cents =
        subtotal - discount + tax. Each line posts a real OUT
        StockMovement out of `warehouse`, through the same
        StockMovementSerializer every other stock-moving feature in
        this project goes through — so an oversell is rejected by that
        serializer's own "not enough stock" check, not re-validated here.
        """
        lines_data = validated_data.pop("lines")
        company = validated_data["company"]
        request = self.context.get("request")

        with transaction.atomic():
            validated_data["cashier"] = getattr(request, "user", None)
            sale = RetailSale.objects.create(**validated_data)
            sale.number = next_number(company, "RSALE")

            created_lines = []
            for line in lines_data:
                item = line["item"]
                variant = line.get("variant")
                if item.company_id != company.id:
                    raise serializers.ValidationError({"lines": "All items must belong to the active company."})
                if variant and (variant.company_id != company.id or variant.item_id != item.id):
                    raise serializers.ValidationError({"lines": "Variant must belong to the selected item."})

                movement_serializer = StockMovementSerializer(
                    data={
                        "item": item.id,
                        "warehouse": sale.warehouse_id,
                        "type": StockMovement.MovementType.OUT,
                        "quantity": line["quantity"],
                        "reference": f"{sale.number} sale",
                    },
                    context=self.context,
                )
                movement_serializer.is_valid(raise_exception=True)
                movement = movement_serializer.save(company=company)
                log_audit(request, movement, AuditLog.Action.CREATED)

                sale_line = RetailSaleLine.objects.create(
                    company=company,
                    sale=sale,
                    item=item,
                    variant=variant,
                    quantity=line["quantity"],
                    unit_price_cents=line["unit_price_cents"],
                    discount_percent=line.get("discount_percent", 0),
                    movement=movement,
                )
                created_lines.append(sale_line)

            subtotal_cents = sum(l.line_total_cents for l in created_lines)
            promotion = sale.promotion
            if promotion and promotion.is_active:
                if promotion.discount_type == Promotion.DiscountType.PERCENT:
                    discount_cents = int(subtotal_cents * promotion.discount_value / 100)
                else:
                    discount_cents = min(int(promotion.discount_value * 100), subtotal_cents)
            else:
                discount_cents = 0
            tax_cents = compute_line_tax_cents(created_lines)

            sale.subtotal_cents = subtotal_cents
            sale.discount_cents = discount_cents
            sale.tax_cents = tax_cents
            sale.total_cents = subtotal_cents - discount_cents + tax_cents
            sale.save(update_fields=["number", "subtotal_cents", "discount_cents", "tax_cents", "total_cents"])
        return sale


class GiftCardSerializer(CompanyScopedSerializer):
    same_company_fields = ["issued_to"]
    issued_to_name = serializers.CharField(source="issued_to.name", read_only=True, default="")

    class Meta:
        model = GiftCard
        fields = [
            "id",
            "code",
            "initial_balance_cents",
            "balance_cents",
            "issued_to",
            "issued_to_name",
            "issued_date",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "balance_cents", "status", "created_at"]

    def create(self, validated_data):
        with transaction.atomic():
            validated_data["balance_cents"] = validated_data["initial_balance_cents"]
            gift_card = super().create(validated_data)
            GiftCardTransaction.objects.create(
                company=gift_card.company,
                gift_card=gift_card,
                type=GiftCardTransaction.Type.ISSUE,
                amount_cents=gift_card.initial_balance_cents,
            )
        return gift_card


class GiftCardTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = GiftCardTransaction
        fields = ["id", "gift_card", "type", "amount_cents", "sale", "created_at"]
        read_only_fields = fields


class RetailReturnLineSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="sale_line.item.name", read_only=True)

    class Meta:
        model = RetailReturnLine
        fields = ["id", "sale_line", "item_name", "quantity", "refund_amount_cents"]
        read_only_fields = ["id", "refund_amount_cents"]


class RetailReturnSerializer(CompanyScopedSerializer):
    same_company_fields = ["sale"]
    sale_number = serializers.CharField(source="sale.number", read_only=True)
    lines = RetailReturnLineSerializer(many=True)

    class Meta:
        model = RetailReturn
        fields = [
            "id",
            "number",
            "sale",
            "sale_number",
            "reason",
            "refund_amount_cents",
            "lines",
            "created_at",
        ]
        read_only_fields = ["id", "number", "refund_amount_cents", "created_at"]

    def validate_lines(self, lines):
        if not lines:
            raise serializers.ValidationError("At least one line item is required.")
        return lines

    def create(self, validated_data):
        """Each line restocks its sale line's item via a real IN
        StockMovement — the feature apps.procurement.PurchaseReturn's
        own docstring flags as deliberately not built there yet.
        Quantity is validated against what that sale line has left to
        return (its original quantity minus whatever prior returns
        already took), so the same line can be partially returned
        across more than one RetailReturn without ever exceeding what
        was actually sold."""
        lines_data = validated_data.pop("lines")
        company = validated_data["company"]
        sale = validated_data["sale"]
        request = self.context.get("request")

        with transaction.atomic():
            retail_return = RetailReturn.objects.create(**validated_data)
            retail_return.number = next_number(company, "RRET")

            total_refund = 0
            for line in lines_data:
                sale_line = line["sale_line"]
                if sale_line.sale_id != sale.id:
                    raise serializers.ValidationError({"lines": "All lines must belong to the selected sale."})
                quantity = line["quantity"]
                if quantity <= 0:
                    raise serializers.ValidationError({"lines": "Quantity must be positive."})

                already_returned = sum(
                    rl.quantity for rl in RetailReturnLine.objects.filter(sale_line=sale_line)
                )
                remaining = sale_line.quantity - already_returned
                if quantity > remaining:
                    raise serializers.ValidationError(
                        {"lines": f"Only {remaining} left to return for {sale_line.item.name}."}
                    )

                movement_serializer = StockMovementSerializer(
                    data={
                        "item": sale_line.item_id,
                        "warehouse": sale.warehouse_id,
                        "type": StockMovement.MovementType.IN,
                        "quantity": quantity,
                        "reference": f"{retail_return.number} return",
                    },
                    context=self.context,
                )
                movement_serializer.is_valid(raise_exception=True)
                movement = movement_serializer.save(company=company)
                log_audit(request, movement, AuditLog.Action.CREATED)

                unit_refund = sale_line.line_total_cents // sale_line.quantity
                refund_amount = unit_refund * quantity
                RetailReturnLine.objects.create(
                    company=company,
                    retail_return=retail_return,
                    sale_line=sale_line,
                    quantity=quantity,
                    refund_amount_cents=refund_amount,
                    movement=movement,
                )
                total_refund += refund_amount

            retail_return.refund_amount_cents = total_refund
            retail_return.save(update_fields=["number", "refund_amount_cents"])

            # Flip the sale's status once every line's full quantity has
            # been returned (across this and any prior RetailReturn).
            sale_lines = list(sale.lines.all())
            fully_returned = all(
                sum(rl.quantity for rl in RetailReturnLine.objects.filter(sale_line=sl)) >= sl.quantity
                for sl in sale_lines
            )
            any_returned = any(
                sum(rl.quantity for rl in RetailReturnLine.objects.filter(sale_line=sl)) > 0 for sl in sale_lines
            )
            if fully_returned:
                sale.status = RetailSale.Status.RETURNED
            elif any_returned:
                sale.status = RetailSale.Status.PARTIALLY_RETURNED
            sale.save(update_fields=["status"])
        return retail_return
