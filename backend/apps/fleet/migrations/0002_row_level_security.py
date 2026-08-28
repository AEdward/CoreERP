from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_VEHICLES, DISABLE_VEHICLES = tenant_policy_sql("fleet_vehicles")
ENABLE_ASSIGNMENTS, DISABLE_ASSIGNMENTS = tenant_policy_sql("fleet_vehicle_assignments")


class Migration(migrations.Migration):
    dependencies = [
        ("fleet", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_VEHICLES, reverse_sql=DISABLE_VEHICLES),
        migrations.RunSQL(ENABLE_ASSIGNMENTS, reverse_sql=DISABLE_ASSIGNMENTS),
    ]
