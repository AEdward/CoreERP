from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_APPROVAL_REQUESTS, DISABLE_APPROVAL_REQUESTS = tenant_policy_sql("approval_requests")


class Migration(migrations.Migration):
    dependencies = [
        ("approvals", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_APPROVAL_REQUESTS, reverse_sql=DISABLE_APPROVAL_REQUESTS),
    ]
