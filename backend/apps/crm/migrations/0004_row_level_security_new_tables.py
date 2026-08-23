from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_CONTACTS, DISABLE_CONTACTS = tenant_policy_sql("contacts")
ENABLE_LEADS, DISABLE_LEADS = tenant_policy_sql("leads")
ENABLE_OPPORTUNITIES, DISABLE_OPPORTUNITIES = tenant_policy_sql("opportunities")


class Migration(migrations.Migration):
    dependencies = [
        ("crm", "0003_contact_lead_opportunity"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_CONTACTS, reverse_sql=DISABLE_CONTACTS),
        migrations.RunSQL(ENABLE_LEADS, reverse_sql=DISABLE_LEADS),
        migrations.RunSQL(ENABLE_OPPORTUNITIES, reverse_sql=DISABLE_OPPORTUNITIES),
    ]
