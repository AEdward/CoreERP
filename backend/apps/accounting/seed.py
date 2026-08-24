"""Default chart of accounts, seeded per company the same way
apps.roles.seed seeds default roles. `role` marks the accounts
posting.py depends on existing — see Account's docstring.
"""

from .models import Account

DEFAULT_ACCOUNTS = [
    # code, name, type, role
    ("1000", "Cash", Account.Type.ASSET, Account.Role.CASH),
    ("1010", "Accounts Receivable", Account.Type.ASSET, Account.Role.ACCOUNTS_RECEIVABLE),
    ("1020", "Inventory", Account.Type.ASSET, None),
    ("1030", "Accumulated Depreciation", Account.Type.ASSET, Account.Role.ACCUMULATED_DEPRECIATION),
    ("2000", "Accounts Payable", Account.Type.LIABILITY, Account.Role.ACCOUNTS_PAYABLE),
    ("2010", "Tax Payable", Account.Type.LIABILITY, Account.Role.TAX_PAYABLE),
    ("2020", "Payroll Payable", Account.Type.LIABILITY, Account.Role.PAYROLL_PAYABLE),
    ("2030", "PAYE Payable", Account.Type.LIABILITY, Account.Role.PAYE_PAYABLE),
    ("2040", "Pension Payable", Account.Type.LIABILITY, Account.Role.PENSION_PAYABLE),
    ("3000", "Owner's Equity", Account.Type.EQUITY, None),
    ("3010", "Retained Earnings", Account.Type.EQUITY, Account.Role.RETAINED_EARNINGS),
    ("4000", "Sales Revenue", Account.Type.REVENUE, Account.Role.SALES_REVENUE),
    ("5000", "Cost of Goods Sold", Account.Type.EXPENSE, None),
    ("5010", "Operating Expenses", Account.Type.EXPENSE, Account.Role.DEFAULT_EXPENSE),
    ("5020", "Salaries Expense", Account.Type.EXPENSE, Account.Role.SALARY_EXPENSE),
    ("5030", "Depreciation Expense", Account.Type.EXPENSE, Account.Role.DEPRECIATION_EXPENSE),
    ("5040", "Pension Expense (Employer)", Account.Type.EXPENSE, Account.Role.PENSION_EXPENSE),
]


def create_default_accounts_for_company(company):
    """Idempotent: safe to call every time a company is created."""
    for code, name, type_, role in DEFAULT_ACCOUNTS:
        Account.objects.get_or_create(
            company=company, code=code, defaults={"name": name, "type": type_, "role": role}
        )
