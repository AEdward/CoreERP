from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_NUMBER_SEQUENCES, DISABLE_NUMBER_SEQUENCES = tenant_policy_sql("number_sequences")


class Migration(migrations.Migration):
    dependencies = [
        ("common", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_NUMBER_SEQUENCES, reverse_sql=DISABLE_NUMBER_SEQUENCES),
    ]
