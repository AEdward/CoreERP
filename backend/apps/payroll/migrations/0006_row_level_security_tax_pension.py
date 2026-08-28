from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_BRACKETS, DISABLE_BRACKETS = tenant_policy_sql("payroll_tax_brackets")
ENABLE_PENSION, DISABLE_PENSION = tenant_policy_sql("payroll_pension_settings")


class Migration(migrations.Migration):
    dependencies = [
        ("payroll", "0005_pensionsettings_taxbracket"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_BRACKETS, reverse_sql=DISABLE_BRACKETS),
        migrations.RunSQL(ENABLE_PENSION, reverse_sql=DISABLE_PENSION),
    ]
