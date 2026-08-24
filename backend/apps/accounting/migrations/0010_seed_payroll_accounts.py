from django.db import migrations


def reseed_payroll_accounts(apps, schema_editor):
    # Same shape as 0007_seed_new_default_accounts: run the real seed
    # helper for every existing company so the new Payroll Payable/PAYE
    # Payable/Pension Payable/Pension Expense accounts apply retroactively.
    # Also explicitly backfills the `role` on the pre-existing "5020
    # Salaries Expense" account, since get_or_create only applies
    # `defaults` (including role) on first creation — an already-existing
    # row with role=None wouldn't otherwise pick up the new
    # SALARY_EXPENSE role apps.payroll's posting code now depends on.
    from django.db import connection

    from apps.companies.models import Company

    from ..models import Account
    from ..seed import create_default_accounts_for_company

    with connection.cursor() as cursor:
        cursor.execute("SET LOCAL app.is_platform_admin = 'true'")

    for company in Company.objects.all():
        create_default_accounts_for_company(company)
        Account.objects.filter(company=company, code="5020", role__isnull=True).update(
            role=Account.Role.SALARY_EXPENSE
        )


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("accounting", "0009_row_level_security_new_tables"),
    ]

    operations = [
        migrations.RunPython(reseed_payroll_accounts, reverse_code=noop),
    ]
