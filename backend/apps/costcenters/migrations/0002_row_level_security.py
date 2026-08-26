from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_COST_CENTERS, DISABLE_COST_CENTERS = tenant_policy_sql("cost_centers")


class Migration(migrations.Migration):
    dependencies = [
        ("costcenters", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_COST_CENTERS, reverse_sql=DISABLE_COST_CENTERS),
    ]
