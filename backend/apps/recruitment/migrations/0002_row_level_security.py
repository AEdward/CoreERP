from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_VACANCIES, DISABLE_VACANCIES = tenant_policy_sql("job_vacancies")
ENABLE_APPLICANTS, DISABLE_APPLICANTS = tenant_policy_sql("applicants")
ENABLE_ONBOARDING, DISABLE_ONBOARDING = tenant_policy_sql("onboarding_tasks")


class Migration(migrations.Migration):
    dependencies = [
        ("recruitment", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_VACANCIES, reverse_sql=DISABLE_VACANCIES),
        migrations.RunSQL(ENABLE_APPLICANTS, reverse_sql=DISABLE_APPLICANTS),
        migrations.RunSQL(ENABLE_ONBOARDING, reverse_sql=DISABLE_ONBOARDING),
    ]
