from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_EXPENSES, DISABLE_EXPENSES = tenant_policy_sql("expenses")


class Migration(migrations.Migration):
    dependencies = [
        ("expenses", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_EXPENSES, reverse_sql=DISABLE_EXPENSES),
    ]
