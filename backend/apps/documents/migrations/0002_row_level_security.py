from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_DOCUMENTS, DISABLE_DOCUMENTS = tenant_policy_sql("documents")


class Migration(migrations.Migration):
    dependencies = [
        ("documents", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_DOCUMENTS, reverse_sql=DISABLE_DOCUMENTS),
    ]
