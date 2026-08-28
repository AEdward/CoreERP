from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_ASSIGNMENTS, DISABLE_ASSIGNMENTS = tenant_policy_sql("hr_shift_assignments")
ENABLE_SWAPS, DISABLE_SWAPS = tenant_policy_sql("hr_shift_swap_requests")


class Migration(migrations.Migration):
    dependencies = [
        ("hr", "0019_shiftassignment_shiftswaprequest_and_more"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_ASSIGNMENTS, reverse_sql=DISABLE_ASSIGNMENTS),
        migrations.RunSQL(ENABLE_SWAPS, reverse_sql=DISABLE_SWAPS),
    ]
