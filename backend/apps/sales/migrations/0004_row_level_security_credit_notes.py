from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_CREDIT_NOTES, DISABLE_CREDIT_NOTES = tenant_policy_sql("credit_notes")


class Migration(migrations.Migration):
    dependencies = [
        ("sales", "0003_creditnote_quotationline_discount_percent_and_more"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_CREDIT_NOTES, reverse_sql=DISABLE_CREDIT_NOTES),
    ]
