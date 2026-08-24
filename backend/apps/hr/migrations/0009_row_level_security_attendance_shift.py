from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_SHIFTS, DISABLE_SHIFTS = tenant_policy_sql("shift_templates")
ENABLE_ATTENDANCE, DISABLE_ATTENDANCE = tenant_policy_sql("attendance_records")


class Migration(migrations.Migration):
    dependencies = [
        ("hr", "0008_attendance_shift"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_SHIFTS, reverse_sql=DISABLE_SHIFTS),
        migrations.RunSQL(ENABLE_ATTENDANCE, reverse_sql=DISABLE_ATTENDANCE),
    ]
