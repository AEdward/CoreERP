from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE, DISABLE = tenant_policy_sql("suppliers")


class Migration(migrations.Migration):
    dependencies = [
        ("suppliers", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [migrations.RunSQL(ENABLE, reverse_sql=DISABLE)]
