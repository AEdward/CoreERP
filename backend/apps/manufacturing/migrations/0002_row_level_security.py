from django.db import migrations

from apps.common.rls import tenant_policy_sql

TABLES = [
    "manufacturing_work_centers",
    "manufacturing_machines",
    "manufacturing_machine_maintenance_logs",
    "manufacturing_boms",
    "manufacturing_bom_lines",
    "manufacturing_bom_byproducts",
    "manufacturing_bom_operations",
    "manufacturing_production_orders",
    "manufacturing_work_orders",
    "manufacturing_material_consumptions",
    "manufacturing_scrap_entries",
    "manufacturing_quality_checks",
]

POLICIES = [tenant_policy_sql(table) for table in TABLES]


class Migration(migrations.Migration):
    dependencies = [
        ("manufacturing", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(enable_sql, reverse_sql=disable_sql) for enable_sql, disable_sql in POLICIES
    ]
