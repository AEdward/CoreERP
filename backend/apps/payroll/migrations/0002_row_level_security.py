from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_COMPONENTS, DISABLE_COMPONENTS = tenant_policy_sql("salary_components")
ENABLE_EMP_COMPONENTS, DISABLE_EMP_COMPONENTS = tenant_policy_sql("employee_salary_components")
ENABLE_RUNS, DISABLE_RUNS = tenant_policy_sql("payroll_runs")
ENABLE_PAYSLIPS, DISABLE_PAYSLIPS = tenant_policy_sql("payslips")
ENABLE_PAYSLIP_LINES, DISABLE_PAYSLIP_LINES = tenant_policy_sql("payslip_lines")


class Migration(migrations.Migration):
    dependencies = [
        ("payroll", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_COMPONENTS, reverse_sql=DISABLE_COMPONENTS),
        migrations.RunSQL(ENABLE_EMP_COMPONENTS, reverse_sql=DISABLE_EMP_COMPONENTS),
        migrations.RunSQL(ENABLE_RUNS, reverse_sql=DISABLE_RUNS),
        migrations.RunSQL(ENABLE_PAYSLIPS, reverse_sql=DISABLE_PAYSLIPS),
        migrations.RunSQL(ENABLE_PAYSLIP_LINES, reverse_sql=DISABLE_PAYSLIP_LINES),
    ]
