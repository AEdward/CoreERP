from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_ACTIVITIES, DISABLE_ACTIVITIES = tenant_policy_sql("activities")


class Migration(migrations.Migration):
    dependencies = [
        ("activity", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_ACTIVITIES, reverse_sql=DISABLE_ACTIVITIES),
    ]
