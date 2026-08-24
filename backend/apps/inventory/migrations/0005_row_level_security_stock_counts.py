from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_COUNTS, DISABLE_COUNTS = tenant_policy_sql("stock_counts")
ENABLE_COUNT_LINES, DISABLE_COUNT_LINES = tenant_policy_sql("stock_count_lines")


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0004_stockcount_stockcountline"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_COUNTS, reverse_sql=DISABLE_COUNTS),
        migrations.RunSQL(ENABLE_COUNT_LINES, reverse_sql=DISABLE_COUNT_LINES),
    ]
