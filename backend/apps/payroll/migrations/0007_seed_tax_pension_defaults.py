from django.db import migrations


def reseed_payroll_settings(apps, schema_editor):
    # Same shape as apps.accounting's 0010/0013 reseed migrations: run
    # the real seed helper for every existing company so companies
    # created before this shipped get the same default PAYE brackets/
    # pension rates that used to be hardcoded in apps.payroll.engine.
    from django.db import connection

    from apps.companies.models import Company

    from ..seed import create_default_payroll_settings_for_company

    with connection.cursor() as cursor:
        cursor.execute("SET LOCAL app.is_platform_admin = 'true'")

    for company in Company.objects.all():
        create_default_payroll_settings_for_company(company)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("payroll", "0006_row_level_security_tax_pension"),
    ]

    operations = [
        migrations.RunPython(reseed_payroll_settings, reverse_code=noop),
    ]
