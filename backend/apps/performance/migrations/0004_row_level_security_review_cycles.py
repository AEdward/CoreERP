from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_CYCLES, DISABLE_CYCLES = tenant_policy_sql("performance_review_cycles")


class Migration(migrations.Migration):
    dependencies = [
        ("performance", "0003_performancereview_rater_type_reviewcycle_and_more"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_CYCLES, reverse_sql=DISABLE_CYCLES),
    ]
