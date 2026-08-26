from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_TRAVEL_AGENCIES, DISABLE_TRAVEL_AGENCIES = tenant_policy_sql("crm_travel_agencies")


class Migration(migrations.Migration):
    dependencies = [
        ("crm", "0005_travel_agency_and_guest_fields"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_TRAVEL_AGENCIES, reverse_sql=DISABLE_TRAVEL_AGENCIES),
    ]
