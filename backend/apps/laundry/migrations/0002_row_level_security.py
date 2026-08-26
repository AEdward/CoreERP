from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_ORDERS, DISABLE_ORDERS = tenant_policy_sql("laundry_orders")
ENABLE_ORDER_LINES, DISABLE_ORDER_LINES = tenant_policy_sql("laundry_order_lines")


class Migration(migrations.Migration):
    dependencies = [
        ("laundry", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_ORDERS, reverse_sql=DISABLE_ORDERS),
        migrations.RunSQL(ENABLE_ORDER_LINES, reverse_sql=DISABLE_ORDER_LINES),
    ]
