from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_AUDIT_LOGS, DISABLE_AUDIT_LOGS = tenant_policy_sql("audit_logs")


class Migration(migrations.Migration):
    dependencies = [
        ("auditlog", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_AUDIT_LOGS, reverse_sql=DISABLE_AUDIT_LOGS),
    ]
