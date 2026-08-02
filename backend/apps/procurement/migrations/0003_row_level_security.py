from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_ORDERS, DISABLE_ORDERS = tenant_policy_sql("purchase_orders")
ENABLE_LINES, DISABLE_LINES = tenant_policy_sql("purchase_order_lines")


class Migration(migrations.Migration):
    dependencies = [
        ("procurement", "0002_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_ORDERS, reverse_sql=DISABLE_ORDERS),
        migrations.RunSQL(ENABLE_LINES, reverse_sql=DISABLE_LINES),
    ]
