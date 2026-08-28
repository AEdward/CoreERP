from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_STRUCTURES, DISABLE_STRUCTURES = tenant_policy_sql("salary_structures")


class Migration(migrations.Migration):
    dependencies = [
        ("hr", "0012_salarystructure_employee_salary_structure_and_more"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_STRUCTURES, reverse_sql=DISABLE_STRUCTURES),
    ]
