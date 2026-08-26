from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_ASSETS, DISABLE_ASSETS = tenant_policy_sql("maintenance_assets")


class Migration(migrations.Migration):
    dependencies = [
        ("maintenance", "0005_asset_workorder_asset"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_ASSETS, reverse_sql=DISABLE_ASSETS),
    ]
