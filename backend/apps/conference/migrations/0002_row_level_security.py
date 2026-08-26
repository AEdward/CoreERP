from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_HALLS, DISABLE_HALLS = tenant_policy_sql("conference_halls")
ENABLE_BOOKINGS, DISABLE_BOOKINGS = tenant_policy_sql("conference_bookings")
ENABLE_BOOKING_LINES, DISABLE_BOOKING_LINES = tenant_policy_sql("conference_booking_lines")


class Migration(migrations.Migration):
    dependencies = [
        ("conference", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_HALLS, reverse_sql=DISABLE_HALLS),
        migrations.RunSQL(ENABLE_BOOKINGS, reverse_sql=DISABLE_BOOKINGS),
        migrations.RunSQL(ENABLE_BOOKING_LINES, reverse_sql=DISABLE_BOOKING_LINES),
    ]
