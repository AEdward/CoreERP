from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_RETURNS, DISABLE_RETURNS = tenant_policy_sql("purchase_returns")


class Migration(migrations.Migration):
    dependencies = [
        ("procurement", "0009_purchasereturn"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_RETURNS, reverse_sql=DISABLE_RETURNS),
    ]
