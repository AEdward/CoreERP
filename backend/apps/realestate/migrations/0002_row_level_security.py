from django.db import migrations

from apps.common.rls import tenant_policy_sql

TABLES = [
    "realestate_projects",
    "realestate_buildings",
    "realestate_unit_types",
    "realestate_units",
    "realestate_listings",
    "realestate_sales_agents",
    "realestate_sales",
    "realestate_payment_installments",
    "realestate_agent_commissions",
    "realestate_lease_contracts",
    "realestate_rent_payments",
    "realestate_maintenance_requests",
    "realestate_property_expenses",
]

POLICIES = [tenant_policy_sql(table) for table in TABLES]


class Migration(migrations.Migration):
    dependencies = [
        ("realestate", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(enable_sql, reverse_sql=disable_sql) for enable_sql, disable_sql in POLICIES
    ]
