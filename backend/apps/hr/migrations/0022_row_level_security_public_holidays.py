from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_HOLIDAYS, DISABLE_HOLIDAYS = tenant_policy_sql("hr_public_holidays")


class Migration(migrations.Migration):
    dependencies = [
        ("hr", "0021_leavetype_accrual_enabled_and_more"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_HOLIDAYS, reverse_sql=DISABLE_HOLIDAYS),
    ]
