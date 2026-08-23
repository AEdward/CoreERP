from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_NOTES, DISABLE_NOTES = tenant_policy_sql("notes")


class Migration(migrations.Migration):
    dependencies = [
        ("notes", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_NOTES, reverse_sql=DISABLE_NOTES),
    ]
