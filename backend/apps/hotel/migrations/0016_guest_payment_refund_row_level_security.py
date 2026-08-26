from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_PAYMENTS, DISABLE_PAYMENTS = tenant_policy_sql("hotel_guest_payments")
ENABLE_REFUNDS, DISABLE_REFUNDS = tenant_policy_sql("hotel_guest_refunds")


class Migration(migrations.Migration):
    dependencies = [
        ("hotel", "0015_guestpayment_guestrefund"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_PAYMENTS, reverse_sql=DISABLE_PAYMENTS),
        migrations.RunSQL(ENABLE_REFUNDS, reverse_sql=DISABLE_REFUNDS),
    ]
