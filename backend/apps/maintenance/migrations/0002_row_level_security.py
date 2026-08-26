from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_WORK_ORDERS, DISABLE_WORK_ORDERS = tenant_policy_sql("maintenance_work_orders")


class Migration(migrations.Migration):
    dependencies = [
        ("maintenance", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_WORK_ORDERS, reverse_sql=DISABLE_WORK_ORDERS),
    ]
