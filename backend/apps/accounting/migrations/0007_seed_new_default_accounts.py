from django.db import migrations


def reseed_default_accounts(apps, schema_editor):
    # Same shape as apps.roles.seed's re-seed migrations: run the real
    # seed helper for every existing company so Retained Earnings /
    # Accumulated Depreciation / Depreciation Expense apply retroactively
    # too, not just to newly-created companies.
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
        ("accounting", "0006_payment_receipt_number"),
    ]

    operations = [
        migrations.RunPython(reseed_default_accounts, reverse_code=noop),
    ]
