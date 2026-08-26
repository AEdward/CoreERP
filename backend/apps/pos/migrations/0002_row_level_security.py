from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_TABLES, DISABLE_TABLES = tenant_policy_sql("pos_tables")
ENABLE_ORDERS, DISABLE_ORDERS = tenant_policy_sql("pos_orders")
ENABLE_ORDER_LINES, DISABLE_ORDER_LINES = tenant_policy_sql("pos_order_lines")


class Migration(migrations.Migration):
    dependencies = [
        ("pos", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_TABLES, reverse_sql=DISABLE_TABLES),
        migrations.RunSQL(ENABLE_ORDERS, reverse_sql=DISABLE_ORDERS),
        migrations.RunSQL(ENABLE_ORDER_LINES, reverse_sql=DISABLE_ORDER_LINES),
    ]
