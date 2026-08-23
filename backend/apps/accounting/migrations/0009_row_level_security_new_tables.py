from django.db import migrations

from apps.common.rls import tenant_policy_sql

ENABLE_PERIODS, DISABLE_PERIODS = tenant_policy_sql("financial_periods")
ENABLE_BANK_ACCOUNTS, DISABLE_BANK_ACCOUNTS = tenant_policy_sql("bank_accounts")
ENABLE_BANK_LINES, DISABLE_BANK_LINES = tenant_policy_sql("bank_statement_lines")
ENABLE_PETTY_FUNDS, DISABLE_PETTY_FUNDS = tenant_policy_sql("petty_cash_funds")
ENABLE_PETTY_TXNS, DISABLE_PETTY_TXNS = tenant_policy_sql("petty_cash_transactions")
ENABLE_BUDGETS, DISABLE_BUDGETS = tenant_policy_sql("budgets")
ENABLE_FIXED_ASSETS, DISABLE_FIXED_ASSETS = tenant_policy_sql("fixed_assets")


class Migration(migrations.Migration):
    dependencies = [
        ("accounting", "0008_alter_account_role_bankaccount_bankstatementline_and_more"),
        ("companies", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunSQL(ENABLE_PERIODS, reverse_sql=DISABLE_PERIODS),
        migrations.RunSQL(ENABLE_BANK_ACCOUNTS, reverse_sql=DISABLE_BANK_ACCOUNTS),
        migrations.RunSQL(ENABLE_BANK_LINES, reverse_sql=DISABLE_BANK_LINES),
        migrations.RunSQL(ENABLE_PETTY_FUNDS, reverse_sql=DISABLE_PETTY_FUNDS),
        migrations.RunSQL(ENABLE_PETTY_TXNS, reverse_sql=DISABLE_PETTY_TXNS),
        migrations.RunSQL(ENABLE_BUDGETS, reverse_sql=DISABLE_BUDGETS),
        migrations.RunSQL(ENABLE_FIXED_ASSETS, reverse_sql=DISABLE_FIXED_ASSETS),
    ]
