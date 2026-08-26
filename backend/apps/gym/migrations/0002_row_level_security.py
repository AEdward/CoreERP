from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_MEMBERSHIPS, DISABLE_MEMBERSHIPS = tenant_policy_sql("gym_memberships")
ENABLE_BOOKINGS, DISABLE_BOOKINGS = tenant_policy_sql("gym_bookings")
ENABLE_BOOKING_LINES, DISABLE_BOOKING_LINES = tenant_policy_sql("gym_booking_lines")


class Migration(migrations.Migration):
    dependencies = [
        ("gym", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_MEMBERSHIPS, reverse_sql=DISABLE_MEMBERSHIPS),
        migrations.RunSQL(ENABLE_BOOKINGS, reverse_sql=DISABLE_BOOKINGS),
        migrations.RunSQL(ENABLE_BOOKING_LINES, reverse_sql=DISABLE_BOOKING_LINES),
    ]
