from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_DOCS, DISABLE_DOCS = tenant_policy_sql("hr_employee_documents")


class Migration(migrations.Migration):
    dependencies = [
        ("hr", "0017_employeedocument"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_DOCS, reverse_sql=DISABLE_DOCS),
    ]
