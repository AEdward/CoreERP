from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_SEASONAL_RATES, DISABLE_SEASONAL_RATES = tenant_policy_sql("hotel_seasonal_rates")


class Migration(migrations.Migration):
    dependencies = [
        ("hotel", "0010_seasonalrate"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_SEASONAL_RATES, reverse_sql=DISABLE_SEASONAL_RATES),
    ]
