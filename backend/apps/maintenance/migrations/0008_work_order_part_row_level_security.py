from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_WORK_ORDER_PARTS, DISABLE_WORK_ORDER_PARTS = tenant_policy_sql("maintenance_work_order_parts")


class Migration(migrations.Migration):
    dependencies = [
        ("maintenance", "0007_workorderpart"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_WORK_ORDER_PARTS, reverse_sql=DISABLE_WORK_ORDER_PARTS),
    ]
