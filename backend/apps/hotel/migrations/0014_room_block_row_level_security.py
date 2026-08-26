from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_ROOM_BLOCKS, DISABLE_ROOM_BLOCKS = tenant_policy_sql("hotel_room_blocks")


class Migration(migrations.Migration):
    dependencies = [
        ("hotel", "0013_roomblock"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_ROOM_BLOCKS, reverse_sql=DISABLE_ROOM_BLOCKS),
    ]
