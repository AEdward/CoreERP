from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_DEPARTMENTS, DISABLE_DEPARTMENTS = tenant_policy_sql("departments")
ENABLE_EMPLOYEES, DISABLE_EMPLOYEES = tenant_policy_sql("employees")


class Migration(migrations.Migration):
    dependencies = [
        ("hr", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_DEPARTMENTS, reverse_sql=DISABLE_DEPARTMENTS),
        migrations.RunSQL(ENABLE_EMPLOYEES, reverse_sql=DISABLE_EMPLOYEES),
    ]
