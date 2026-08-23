from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_TAX_RATES, DISABLE_TAX_RATES = tenant_policy_sql("tax_rates")


class Migration(migrations.Migration):
    dependencies = [
        ("tax", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_TAX_RATES, reverse_sql=DISABLE_TAX_RATES),
    ]
