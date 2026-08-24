from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_LOCATIONS, DISABLE_LOCATIONS = tenant_policy_sql("storage_locations")


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0006_storagelocation_stockmovement_location_and_more"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_LOCATIONS, reverse_sql=DISABLE_LOCATIONS),
    ]
