from django.db import migrations

from apps.common.rls import tenant_policy_sql

TABLES = [
    "construction_projects",
    "construction_boq_items",
    "construction_contracts",
    "construction_site_logs",
    "construction_material_issues",
    "construction_equipment",
    "construction_equipment_assignments",
    "construction_labor_assignments",
    "construction_site_expenses",
    "construction_change_orders",
    "construction_quality_inspections",
    "construction_safety_incidents",
]

POLICIES = [tenant_policy_sql(table) for table in TABLES]


class Migration(migrations.Migration):
    dependencies = [
        ("construction", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(enable_sql, reverse_sql=disable_sql) for enable_sql, disable_sql in POLICIES
    ]
