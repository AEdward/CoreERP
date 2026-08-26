from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_TIERS, DISABLE_TIERS = tenant_policy_sql("loyalty_tiers")
ENABLE_REWARDS, DISABLE_REWARDS = tenant_policy_sql("loyalty_rewards")
ENABLE_MEMBERS, DISABLE_MEMBERS = tenant_policy_sql("loyalty_members")
ENABLE_TRANSACTIONS, DISABLE_TRANSACTIONS = tenant_policy_sql("loyalty_transactions")


class Migration(migrations.Migration):
    dependencies = [
        ("loyalty", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_TIERS, reverse_sql=DISABLE_TIERS),
        migrations.RunSQL(ENABLE_REWARDS, reverse_sql=DISABLE_REWARDS),
        migrations.RunSQL(ENABLE_MEMBERS, reverse_sql=DISABLE_MEMBERS),
        migrations.RunSQL(ENABLE_TRANSACTIONS, reverse_sql=DISABLE_TRANSACTIONS),
    ]
