from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_GROUP_RESERVATIONS, DISABLE_GROUP_RESERVATIONS = tenant_policy_sql("hotel_group_reservations")


class Migration(migrations.Migration):
    dependencies = [
        ("hotel", "0008_alter_reservation_source_groupreservation_and_more"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_GROUP_RESERVATIONS, reverse_sql=DISABLE_GROUP_RESERVATIONS),
    ]
