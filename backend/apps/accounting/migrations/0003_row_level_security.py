from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_ACCOUNTS, DISABLE_ACCOUNTS = tenant_policy_sql("accounts")
ENABLE_ENTRIES, DISABLE_ENTRIES = tenant_policy_sql("journal_entries")
ENABLE_LINES, DISABLE_LINES = tenant_policy_sql("journal_lines")
ENABLE_PAYMENTS, DISABLE_PAYMENTS = tenant_policy_sql("payments")


class Migration(migrations.Migration):
    dependencies = [
        ("accounting", "0002_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_ACCOUNTS, reverse_sql=DISABLE_ACCOUNTS),
        migrations.RunSQL(ENABLE_ENTRIES, reverse_sql=DISABLE_ENTRIES),
        migrations.RunSQL(ENABLE_LINES, reverse_sql=DISABLE_LINES),
        migrations.RunSQL(ENABLE_PAYMENTS, reverse_sql=DISABLE_PAYMENTS),
    ]
