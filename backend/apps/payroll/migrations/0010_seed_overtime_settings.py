from django.db import migrations


def reseed_overtime_settings(apps, schema_editor):
    # Same "run the real seed helper for every existing company" pattern
    # as 0007_seed_tax_pension_defaults — companies created before this
    # shipped get the same default OvertimeSettings row. Calls
    # seed_overtime_defaults specifically (not the combined
    # create_default_payroll_settings_for_company) — same reasoning as
    # 0007's own fix: a migration should only ever call the slice of
    # seed.py whose tables exist at that point in migration history.
    from django.db import connection

    from apps.companies.models import Company

    from ..seed import seed_overtime_defaults

    with connection.cursor() as cursor:
        cursor.execute("SET LOCAL app.is_platform_admin = 'true'")

    for company in Company.objects.all():
        seed_overtime_defaults(company)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("payroll", "0009_row_level_security_overtime_settings"),
    ]

    operations = [
        migrations.RunPython(reseed_overtime_settings, reverse_code=noop),
    ]
