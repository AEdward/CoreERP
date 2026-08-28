from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_LOANS, DISABLE_LOANS = tenant_policy_sql("loans")


class Migration(migrations.Migration):
    dependencies = [
        ("payroll", "0003_payslip_loan_repayment_cents_loan_and_more"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_LOANS, reverse_sql=DISABLE_LOANS),
    ]
