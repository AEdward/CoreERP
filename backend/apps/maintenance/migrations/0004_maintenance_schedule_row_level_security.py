from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_MAINTENANCE_SCHEDULES, DISABLE_MAINTENANCE_SCHEDULES = tenant_policy_sql("maintenance_schedules")


class Migration(migrations.Migration):
    dependencies = [
        ("maintenance", "0003_maintenanceschedule_workorder_schedule"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_MAINTENANCE_SCHEDULES, reverse_sql=DISABLE_MAINTENANCE_SCHEDULES),
    ]
