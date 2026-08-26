from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_BOOKINGS, DISABLE_BOOKINGS = tenant_policy_sql("spa_bookings")
ENABLE_BOOKING_LINES, DISABLE_BOOKING_LINES = tenant_policy_sql("spa_booking_lines")


class Migration(migrations.Migration):
    dependencies = [
        ("spa", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_BOOKINGS, reverse_sql=DISABLE_BOOKINGS),
        migrations.RunSQL(ENABLE_BOOKING_LINES, reverse_sql=DISABLE_BOOKING_LINES),
    ]
