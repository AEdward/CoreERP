from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_REQUESTS, DISABLE_REQUESTS = tenant_policy_sql("purchase_requests")
ENABLE_REQUEST_LINES, DISABLE_REQUEST_LINES = tenant_policy_sql("purchase_request_lines")


class Migration(migrations.Migration):
    dependencies = [
        ("procurement", "0007_purchaseorderline_received_quantity_purchaserequest_and_more"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_REQUESTS, reverse_sql=DISABLE_REQUESTS),
        migrations.RunSQL(ENABLE_REQUEST_LINES, reverse_sql=DISABLE_REQUEST_LINES),
    ]
