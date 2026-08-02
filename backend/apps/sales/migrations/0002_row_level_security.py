from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_QUOTATIONS, DISABLE_QUOTATIONS = tenant_policy_sql("quotations")
ENABLE_QUOTATION_LINES, DISABLE_QUOTATION_LINES = tenant_policy_sql("quotation_lines")
ENABLE_SALES_ORDERS, DISABLE_SALES_ORDERS = tenant_policy_sql("sales_orders")
ENABLE_SALES_ORDER_LINES, DISABLE_SALES_ORDER_LINES = tenant_policy_sql("sales_order_lines")
ENABLE_INVOICES, DISABLE_INVOICES = tenant_policy_sql("invoices")


class Migration(migrations.Migration):
    dependencies = [
        ("sales", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_QUOTATIONS, reverse_sql=DISABLE_QUOTATIONS),
        migrations.RunSQL(ENABLE_QUOTATION_LINES, reverse_sql=DISABLE_QUOTATION_LINES),
        migrations.RunSQL(ENABLE_SALES_ORDERS, reverse_sql=DISABLE_SALES_ORDERS),
        migrations.RunSQL(ENABLE_SALES_ORDER_LINES, reverse_sql=DISABLE_SALES_ORDER_LINES),
        migrations.RunSQL(ENABLE_INVOICES, reverse_sql=DISABLE_INVOICES),
    ]
