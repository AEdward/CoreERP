from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_BUILDINGS, DISABLE_BUILDINGS = tenant_policy_sql("hotel_buildings")
ENABLE_FLOORS, DISABLE_FLOORS = tenant_policy_sql("hotel_floors")
ENABLE_ROOM_TYPES, DISABLE_ROOM_TYPES = tenant_policy_sql("hotel_room_types")
ENABLE_ROOMS, DISABLE_ROOMS = tenant_policy_sql("hotel_rooms")
ENABLE_ROOM_STATUS_LOGS, DISABLE_ROOM_STATUS_LOGS = tenant_policy_sql("hotel_room_status_logs")
ENABLE_RESERVATIONS, DISABLE_RESERVATIONS = tenant_policy_sql("hotel_reservations")
ENABLE_GUEST_FOLIOS, DISABLE_GUEST_FOLIOS = tenant_policy_sql("hotel_guest_folios")
ENABLE_FOLIO_CHARGES, DISABLE_FOLIO_CHARGES = tenant_policy_sql("hotel_folio_charges")


class Migration(migrations.Migration):
    dependencies = [
        ("hotel", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_BUILDINGS, reverse_sql=DISABLE_BUILDINGS),
        migrations.RunSQL(ENABLE_FLOORS, reverse_sql=DISABLE_FLOORS),
        migrations.RunSQL(ENABLE_ROOM_TYPES, reverse_sql=DISABLE_ROOM_TYPES),
        migrations.RunSQL(ENABLE_ROOMS, reverse_sql=DISABLE_ROOMS),
        migrations.RunSQL(ENABLE_ROOM_STATUS_LOGS, reverse_sql=DISABLE_ROOM_STATUS_LOGS),
        migrations.RunSQL(ENABLE_RESERVATIONS, reverse_sql=DISABLE_RESERVATIONS),
        migrations.RunSQL(ENABLE_GUEST_FOLIOS, reverse_sql=DISABLE_GUEST_FOLIOS),
        migrations.RunSQL(ENABLE_FOLIO_CHARGES, reverse_sql=DISABLE_FOLIO_CHARGES),
    ]
