from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_TASKS, DISABLE_TASKS = tenant_policy_sql("tasks")


class Migration(migrations.Migration):
    dependencies = [
        ("tasks", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_TASKS, reverse_sql=DISABLE_TASKS),
    ]
