from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_EVENTS, DISABLE_EVENTS = tenant_policy_sql("calendar_events")


class Migration(migrations.Migration):
    dependencies = [
        ("calendar", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_EVENTS, reverse_sql=DISABLE_EVENTS),
    ]
