from django.conf import settings
from django.core.validators import MaxValueValidator
from django.db import models

from apps.branches.models import Branch
from apps.catalog.models import Item
from apps.common.models import TenantModel
from apps.crm.models import Customer
from apps.inventory.models import StockMovement, Warehouse

# Section L: Retail — a retail-checkout POS, deliberately separate from
# apps.pos (ported from MiranErp, restaurant/bar-flavored: tables,
# kitchen display, happy hour — see docs/MODULE_MAP.md Section L's own
# note on why that isn't the right shape here). Designed fresh, no
# source ported. "Multi-store Management" isn't a new model — a
# Register just optionally belongs to an existing apps.branches.Branch,
# the same location concept every other module already uses. Omnichannel
# Commerce / E-commerce Integration are deliberately out of scope: no
# actual external channel or storefront exists to integrate with, so
# there's nothing real to build against — same restraint as
# apps.manufacturing's Production Scheduling gap.


class Register(TenantModel):
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name="registers")
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=32, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "retail_registers"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_register_name")
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class CashierShift(TenantModel):
    """One cashier's stretch at one Register — "Shifts" + "Cashier
    Management". Open/close only (see CashierShiftViewSet.close);
    validated to at most one open shift per register at a time, the
    same shape apps.fleet.VehicleAssignment uses for "who's currently
    holding this" (app-layer check in the serializer, not a DB
    constraint — a partial unique index would need raw SQL this
    project's migration style otherwise avoids for a single-field
    invariant like this)."""

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        CLOSED = "closed", "Closed"

    register = models.ForeignKey(Register, on_delete=models.PROTECT, related_name="shifts")
    cashier = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    opening_float_cents = models.BigIntegerField(default=0)
    closing_amount_cents = models.BigIntegerField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "retail_cashier_shifts"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.register} — {self.cashier} ({self.status})"


class ProductVariant(TenantModel):
    """A specific scannable SKU of an Item — "Red / Medium" — for
    "Product Variants" + the variant half of "Barcode POS" (a plain
    Item without variants uses Item.barcode directly instead). Stock
    quantity is still tracked at the Item level, not per-variant — the
    same known simplification apps.inventory.StorageLocation's own
    docstring accepts for bin-level tracking: a real per-variant stock
    split is a bigger schema change (touching Stock's own uniqueness
    and every place that reads/writes Stock.quantity) than this feature
    needs to justify on its own."""

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="variants")
    name = models.CharField(max_length=100)
    sku = models.CharField(max_length=64, blank=True)
    barcode = models.CharField(max_length=64, blank=True)
    price_cents = models.BigIntegerField(null=True, blank=True, help_text="Overrides Item.price_cents when set.")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "retail_product_variants"
        constraints = [
            models.UniqueConstraint(fields=["item", "name"], name="unique_item_variant_name")
        ]
        ordering = ["item_id", "name"]

    def __str__(self):
        return f"{self.item} — {self.name}"


class Promotion(TenantModel):
    """A named, time-bound campaign discount a cashier selects on a
    sale's header — separate from the ad hoc per-line
    RetailSaleLine.discount_percent (same line-item discount shape
    apps.sales.SalesOrderLine already established)."""

    class DiscountType(models.TextChoices):
        PERCENT = "percent", "Percent"
        FIXED = "fixed", "Fixed amount"

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=32, blank=True)
    discount_type = models.CharField(max_length=16, choices=DiscountType.choices, default=DiscountType.PERCENT)
    discount_value = models.DecimalField(max_digits=10, decimal_places=2)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "retail_promotions"
        ordering = ["name"]

    def __str__(self):
        return self.name


class RetailSale(TenantModel):
    class PaymentMethod(models.TextChoices):
        CASH = "cash", "Cash"
        CARD = "card", "Card"
        MOBILE_MONEY = "mobile_money", "Mobile money"
        GIFT_CARD = "gift_card", "Gift card"

    class Status(models.TextChoices):
        COMPLETED = "completed", "Completed"
        PARTIALLY_RETURNED = "partially_returned", "Partially returned"
        RETURNED = "returned", "Returned"

    number = models.CharField(max_length=20)
    register = models.ForeignKey(Register, on_delete=models.PROTECT, related_name="sales")
    shift = models.ForeignKey(CashierShift, on_delete=models.PROTECT, related_name="sales")
    warehouse = models.ForeignKey(Warehouse, on_delete=models.PROTECT, related_name="+")
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    cashier = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    promotion = models.ForeignKey(Promotion, on_delete=models.SET_NULL, null=True, blank=True, related_name="sales")
    payment_method = models.CharField(max_length=16, choices=PaymentMethod.choices, default=PaymentMethod.CASH)
    # subtotal_cents is post line-discount, pre-promotion — see
    # RetailSaleViewSet's checkout docstring for the full totals shape.
    subtotal_cents = models.BigIntegerField(default=0)
    discount_cents = models.BigIntegerField(default=0)
    tax_cents = models.BigIntegerField(default=0)
    total_cents = models.BigIntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.COMPLETED)

    class Meta:
        db_table = "retail_sales"
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_company_retail_sale_number")
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return self.number


class RetailSaleLine(TenantModel):
    sale = models.ForeignKey(RetailSale, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="+")
    variant = models.ForeignKey(ProductVariant, on_delete=models.PROTECT, null=True, blank=True, related_name="+")
    quantity = models.PositiveIntegerField()
    unit_price_cents = models.BigIntegerField()
    discount_percent = models.PositiveIntegerField(default=0, validators=[MaxValueValidator(100)])
    # The OUT movement this line's checkout posted — same audit-trail
    # link apps.manufacturing.MaterialConsumption keeps to its own
    # StockMovement.
    movement = models.ForeignKey(StockMovement, on_delete=models.PROTECT, related_name="+")

    class Meta:
        db_table = "retail_sale_lines"
        constraints = [
            models.CheckConstraint(
                condition=models.Q(discount_percent__lte=100), name="retail_sale_line_discount_max_100"
            )
        ]
        ordering = ["-created_at"]

    @property
    def line_total_cents(self):
        gross = self.quantity * self.unit_price_cents
        return gross - (gross * self.discount_percent // 100)

    def __str__(self):
        return f"{self.quantity} x {self.item} ({self.sale})"


class GiftCard(TenantModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        REDEEMED = "redeemed", "Fully redeemed"
        EXPIRED = "expired", "Expired"

    code = models.CharField(max_length=32)
    initial_balance_cents = models.BigIntegerField()
    balance_cents = models.BigIntegerField()
    issued_to = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    issued_date = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)

    class Meta:
        db_table = "retail_gift_cards"
        constraints = [
            models.UniqueConstraint(fields=["company", "code"], name="unique_company_gift_card_code")
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return self.code


class GiftCardTransaction(TenantModel):
    class Type(models.TextChoices):
        ISSUE = "issue", "Issue"
        RELOAD = "reload", "Reload"
        REDEEM = "redeem", "Redeem"

    gift_card = models.ForeignKey(GiftCard, on_delete=models.CASCADE, related_name="transactions")
    type = models.CharField(max_length=16, choices=Type.choices)
    amount_cents = models.BigIntegerField()
    sale = models.ForeignKey(RetailSale, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")

    class Meta:
        db_table = "retail_gift_card_transactions"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.type} {self.amount_cents} — {self.gift_card}"


class RetailReturn(TenantModel):
    """A processed return against a completed RetailSale — created
    already-final, the same one-step shape apps.inventory.StockCount's
    own finalize action and apps.procurement's Goods Receipt use, not a
    draft/approval workflow. Unlike apps.procurement.PurchaseReturn
    (financial-only by its own design, deliberately deferring a real
    stock reversal — see that model's docstring), this is the feature
    that actually posts one: each RetailReturnLine's quantity restocks
    the item via a real IN StockMovement, validated against what that
    sale line has left to return."""

    number = models.CharField(max_length=20)
    sale = models.ForeignKey(RetailSale, on_delete=models.PROTECT, related_name="returns")
    reason = models.CharField(max_length=255, blank=True)
    refund_amount_cents = models.BigIntegerField(default=0)

    class Meta:
        db_table = "retail_returns"
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_company_retail_return_number")
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return self.number


class RetailReturnLine(TenantModel):
    retail_return = models.ForeignKey(RetailReturn, on_delete=models.CASCADE, related_name="lines")
    sale_line = models.ForeignKey(RetailSaleLine, on_delete=models.PROTECT, related_name="return_lines")
    quantity = models.PositiveIntegerField()
    refund_amount_cents = models.BigIntegerField()
    movement = models.ForeignKey(StockMovement, on_delete=models.PROTECT, related_name="+")

    class Meta:
        db_table = "retail_return_lines"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.quantity} x {self.sale_line.item} ({self.retail_return})"
