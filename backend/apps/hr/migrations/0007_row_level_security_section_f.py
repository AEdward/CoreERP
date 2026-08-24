from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_POSITIONS, DISABLE_POSITIONS = tenant_policy_sql("positions")
ENABLE_CONTRACTS, DISABLE_CONTRACTS = tenant_policy_sql("employee_contracts")
ENABLE_LEAVE_TYPES, DISABLE_LEAVE_TYPES = tenant_policy_sql("leave_types")
ENABLE_LEAVE_REQUESTS, DISABLE_LEAVE_REQUESTS = tenant_policy_sql("leave_requests")


class Migration(migrations.Migration):
    dependencies = [
        ("hr", "0006_finish_position_fk"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_POSITIONS, reverse_sql=DISABLE_POSITIONS),
        migrations.RunSQL(ENABLE_CONTRACTS, reverse_sql=DISABLE_CONTRACTS),
        migrations.RunSQL(ENABLE_LEAVE_TYPES, reverse_sql=DISABLE_LEAVE_TYPES),
        migrations.RunSQL(ENABLE_LEAVE_REQUESTS, reverse_sql=DISABLE_LEAVE_REQUESTS),
    ]
