from django.db import migrations


def reseed_default_roles(apps, schema_editor):
    # Uses the real seed helper (not the historical apps.get_model
    # versions) since it's plain permission/role bookkeeping with no
    # schema dependency — re-running it for every existing company is
    # exactly what create_default_roles_for_company is designed to do
    # idempotently. Only touches the five seeded default roles' permission
    # sets; a company's own custom roles (once that feature exists) are
    # untouched since this only get_or_creates/permissions.set()s roles
    # matching DEFAULT_ROLES's names.
    from django.db import connection

    from apps.companies.models import Company

    from ..seed import create_default_roles_for_company

    # Outside a request, CurrentCompanyMiddleware never ran, so the RLS
    # session vars are unset — companies' own FORCE ROW LEVEL SECURITY
    # policy would make Company.objects.all() return nothing here, same
    # "INSERT...RETURNING is subject to the SELECT policy too" class of
    # issue as the company-bootstrap bypass in apps.companies.views.
    with connection.cursor() as cursor:
        cursor.execute("SET LOCAL app.is_platform_admin = 'true'")

    for company in Company.objects.all():
        create_default_roles_for_company(company)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        ("roles", "0002_row_level_security"),
    ]

    operations = [
        migrations.RunPython(reseed_default_roles, reverse_code=noop),
    ]
