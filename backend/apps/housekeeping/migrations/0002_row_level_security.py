from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_TASKS, DISABLE_TASKS = tenant_policy_sql("housekeeping_tasks")


class Migration(migrations.Migration):
    dependencies = [
        ("housekeeping", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_TASKS, reverse_sql=DISABLE_TASKS),
    ]
