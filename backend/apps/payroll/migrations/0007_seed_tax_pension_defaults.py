from django.db import migrations


def reseed_payroll_settings(apps, schema_editor):
    # Same shape as apps.accounting's 0010/0013 reseed migrations: run
    # the real seed helper for every existing company so companies
    # created before this shipped get the same default PAYE brackets/
    # pension rates that used to be hardcoded in apps.payroll.engine.
    #
    # Deliberately calls seed_tax_and_pension_defaults, not the combined
    # create_default_payroll_settings_for_company — a RunPython migration
    # calls live application code, not a frozen snapshot of it, and by
    # the time this shipped that combined function also seeded
    # OvertimeSettings, whose table doesn't exist until migration 0008.
    # Calling the combined function here broke `migrate` from empty.
    from django.db import connection

    from apps.companies.models import Company

    from ..seed import seed_tax_and_pension_defaults

    with connection.cursor() as cursor:
        cursor.execute("SET LOCAL app.is_platform_admin = 'true'")

    for company in Company.objects.all():
        seed_tax_and_pension_defaults(company)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("payroll", "0006_row_level_security_tax_pension"),
    ]

    operations = [
        migrations.RunPython(reseed_payroll_settings, reverse_code=noop),
    ]
