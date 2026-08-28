from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_OVERTIME, DISABLE_OVERTIME = tenant_policy_sql("payroll_overtime_settings")


class Migration(migrations.Migration):
    dependencies = [
        ("payroll", "0008_overtimesettings"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_OVERTIME, reverse_sql=DISABLE_OVERTIME),
    ]
