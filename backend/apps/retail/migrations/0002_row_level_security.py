from django.db import migrations

from apps.common.rls import tenant_policy_sql

TABLES = [
    "retail_registers",
    "retail_cashier_shifts",
    "retail_product_variants",
    "retail_promotions",
    "retail_sales",
    "retail_sale_lines",
    "retail_gift_cards",
    "retail_gift_card_transactions",
    "retail_returns",
    "retail_return_lines",
]

POLICIES = [tenant_policy_sql(table) for table in TABLES]


class Migration(migrations.Migration):
    dependencies = [
        ("retail", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(enable_sql, reverse_sql=disable_sql) for enable_sql, disable_sql in POLICIES
    ]
