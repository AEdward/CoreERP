from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_HAPPY_HOUR_RULES, DISABLE_HAPPY_HOUR_RULES = tenant_policy_sql("pos_happy_hour_rules")
ENABLE_PROMOTIONS, DISABLE_PROMOTIONS = tenant_policy_sql("pos_promotions")


class Migration(migrations.Migration):
    dependencies = [
        ("pos", "0004_order_tab_name_happyhourrule_promotion_and_more"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_HAPPY_HOUR_RULES, reverse_sql=DISABLE_HAPPY_HOUR_RULES),
        migrations.RunSQL(ENABLE_PROMOTIONS, reverse_sql=DISABLE_PROMOTIONS),
    ]
