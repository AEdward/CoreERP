from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_SKILLS, DISABLE_SKILLS = tenant_policy_sql("hr_skills")
ENABLE_EMPLOYEE_SKILLS, DISABLE_EMPLOYEE_SKILLS = tenant_policy_sql("hr_employee_skills")


class Migration(migrations.Migration):
    dependencies = [
        ("hr", "0023_skill_employeeskill_skill_unique_company_skill_name_and_more"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_SKILLS, reverse_sql=DISABLE_SKILLS),
        migrations.RunSQL(ENABLE_EMPLOYEE_SKILLS, reverse_sql=DISABLE_EMPLOYEE_SKILLS),
    ]
