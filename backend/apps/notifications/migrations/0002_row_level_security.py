from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_NOTIFICATIONS, DISABLE_NOTIFICATIONS = tenant_policy_sql("notifications")


class Migration(migrations.Migration):
    dependencies = [
        ("notifications", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_NOTIFICATIONS, reverse_sql=DISABLE_NOTIFICATIONS),
    ]
