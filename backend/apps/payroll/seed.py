"""Default payroll tax/pension/overtime configuration, seeded per company the same
way apps.accounting.seed seeds the chart of accounts and apps.roles.seed
seeds default roles — called once at company-creation time
(apps.companies.views.CompanyListCreateView.post) and retroactively via a
data migration for companies that already existed when this shipped.
"""

from decimal import Decimal

from .models import OvertimeSettings, PensionSettings, TaxBracket

# Ethiopia's Federal Income Tax (Amendment) Proclamation No. 1395/2025,
# effective 7 July 2025 — the same six bands apps.payroll.engine used to
# hardcode directly, now just this module's seed data instead.
DEFAULT_TAX_BRACKETS_CENTS = [
    # (lower_bound_cents, upper_bound_cents or None for the top bracket, rate_percent)
    (0, 200_000, Decimal("0.00")),
    (200_000, 400_000, Decimal("15.00")),
    (400_000, 700_000, Decimal("20.00")),
    (700_000, 1_000_000, Decimal("25.00")),
    (1_000_000, 1_400_000, Decimal("30.00")),
    (1_400_000, None, Decimal("35.00")),
]

DEFAULT_PENSION_EMPLOYEE_RATE = Decimal("7.00")
DEFAULT_PENSION_EMPLOYER_RATE = Decimal("11.00")


def seed_tax_and_pension_defaults(company):
    """Idempotent: safe to call every time a company is created. Only
    seeds brackets if none exist yet — a company that's already
    customized or cleared its brackets shouldn't have defaults silently
    re-added.

    Kept as its own function (not folded into
    create_default_payroll_settings_for_company) so migration
    0007_seed_tax_pension_defaults — which ran before OvertimeSettings'
    table existed — can call exactly this and nothing that touches a
    table from a later migration. A migration's RunPython calls live
    application code, not a frozen historical snapshot of it, so this
    function must never grow a dependency on anything that didn't exist
    at 0007's point in migration history."""
    if not TaxBracket.objects.filter(company=company).exists():
        TaxBracket.objects.bulk_create(
            [
                TaxBracket(company=company, lower_bound_cents=lower, upper_bound_cents=upper, rate_percent=rate)
                for lower, upper, rate in DEFAULT_TAX_BRACKETS_CENTS
            ]
        )
    PensionSettings.objects.get_or_create(
        company=company,
        defaults={
            "employee_rate_percent": DEFAULT_PENSION_EMPLOYEE_RATE,
            "employer_rate_percent": DEFAULT_PENSION_EMPLOYER_RATE,
        },
    )


def seed_overtime_defaults(company):
    """Idempotent. Split out for the same reason as
    seed_tax_and_pension_defaults — this is the piece
    0010_seed_overtime_settings calls, once OvertimeSettings' table
    actually exists."""
    OvertimeSettings.objects.get_or_create(company=company)


def create_default_payroll_settings_for_company(company):
    """The current-code convenience entry point — everything a
    brand-new company needs, called from
    apps.companies.views.CompanyListCreateView.post. Migrations call
    the two pieces above individually instead of this, so each one only
    ever touches tables that exist at its own point in history."""
    seed_tax_and_pension_defaults(company)
    seed_overtime_defaults(company)
