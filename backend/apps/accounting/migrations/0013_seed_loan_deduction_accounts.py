from django.db import migrations


def reseed_loan_deduction_accounts(apps, schema_editor):
    # Same shape as 0010_seed_payroll_accounts: run the real seed helper
    # for every existing company so the new Employee Loan Receivable /
    # Other Payroll Deductions Payable accounts (Section F: Loans /
    # Employee Advances, plus a real fix for a pre-existing bug — the
    # payroll journal entry was silently unbalanced by other_deductions_cents
    # whenever any custom SalaryComponent deduction existed, since it had
    # no GL destination of its own) apply retroactively.
    from django.db import connection

    from apps.companies.models import Company

    from ..seed import create_default_accounts_for_company

    with connection.cursor() as cursor:
        cursor.execute("SET LOCAL app.is_platform_admin = 'true'")

    for company in Company.objects.all():
        create_default_accounts_for_company(company)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("accounting", "0012_alter_account_role_loans_deductions"),
    ]

    operations = [
        migrations.RunPython(reseed_loan_deduction_accounts, reverse_code=noop),
    ]
