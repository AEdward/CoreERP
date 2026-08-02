from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_WAREHOUSES, DISABLE_WAREHOUSES = tenant_policy_sql("warehouses")
ENABLE_STOCK, DISABLE_STOCK = tenant_policy_sql("stock")
ENABLE_MOVEMENTS, DISABLE_MOVEMENTS = tenant_policy_sql("stock_movements")


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_WAREHOUSES, reverse_sql=DISABLE_WAREHOUSES),
        migrations.RunSQL(ENABLE_STOCK, reverse_sql=DISABLE_STOCK),
        migrations.RunSQL(ENABLE_MOVEMENTS, reverse_sql=DISABLE_MOVEMENTS),
    ]
