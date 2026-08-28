from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_REVIEWS, DISABLE_REVIEWS = tenant_policy_sql("performance_reviews")
ENABLE_PROGRAMS, DISABLE_PROGRAMS = tenant_policy_sql("training_programs")
ENABLE_ENROLLMENTS, DISABLE_ENROLLMENTS = tenant_policy_sql("training_enrollments")


class Migration(migrations.Migration):
    dependencies = [
        ("performance", "0001_initial"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_REVIEWS, reverse_sql=DISABLE_REVIEWS),
        migrations.RunSQL(ENABLE_PROGRAMS, reverse_sql=DISABLE_PROGRAMS),
        migrations.RunSQL(ENABLE_ENROLLMENTS, reverse_sql=DISABLE_ENROLLMENTS),
    ]
