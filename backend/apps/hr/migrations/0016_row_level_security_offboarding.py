from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_OFFBOARDING, DISABLE_OFFBOARDING = tenant_policy_sql("hr_offboarding")


class Migration(migrations.Migration):
    dependencies = [
        ("hr", "0015_offboarding"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_OFFBOARDING, reverse_sql=DISABLE_OFFBOARDING),
    ]
