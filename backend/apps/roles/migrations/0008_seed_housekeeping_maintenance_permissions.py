from django.db import migrations


def reseed_default_roles(apps, schema_editor):
    # Same shape as 0003-0007: re-run the real seed helper for every
    # existing company so housekeeping.*/maintenance.* (Section J: Hotel
    # & Hospitality satellite apps, ported from AEdward/MiranErp) apply
    # retroactively too. costcenters piggybacks on the existing
    # settings.manage permission, so it needs no new permission rows here.
    from django.db import connection

    from apps.companies.models import Company

    from ..seed import create_default_roles_for_company

    with connection.cursor() as cursor:
        cursor.execute("SET LOCAL app.is_platform_admin = 'true'")

    for company in Company.objects.all():
        create_default_roles_for_company(company)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("roles", "0007_seed_hotel_permission"),
    ]

    operations = [
        migrations.RunPython(reseed_default_roles, reverse_code=noop),
    ]
