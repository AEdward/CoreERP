from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_ROOM_TRANSFERS, DISABLE_ROOM_TRANSFERS = tenant_policy_sql("hotel_room_transfers")


class Migration(migrations.Migration):
    dependencies = [
        ("hotel", "0006_roomtransfer"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_ROOM_TRANSFERS, reverse_sql=DISABLE_ROOM_TRANSFERS),
    ]
