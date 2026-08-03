from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_BRANCHES, DISABLE_BRANCHES = tenant_policy_sql("branches")


class Migration(migrations.Migration):
    dependencies = [
        ("branches", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_BRANCHES, reverse_sql=DISABLE_BRANCHES),
    ]
