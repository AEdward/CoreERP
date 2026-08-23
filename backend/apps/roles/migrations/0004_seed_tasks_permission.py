from django.db import migrations


def reseed_default_roles(apps, schema_editor):
    # Same shape and same reason as 0003_seed_settings_view_permission:
    # re-run the real seed helper for every existing company so the new
    # tasks.view/tasks.manage permissions apply retroactively, not just
    # to companies created from now on.
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
        ("roles", "0003_seed_settings_view_permission"),
    ]

    operations = [
        migrations.RunPython(reseed_default_roles, reverse_code=noop),
    ]
