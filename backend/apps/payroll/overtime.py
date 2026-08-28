"""Overtime hours -> pay, isolated from process_payroll_run — same
"compute module separate from the HTTP/engine layer" pattern engine.py's
PAYE/pension helpers use, ported from MiranErp's overtime.py.

CoreERP's AttendanceRecord.overtime_hours already derives each record's
overtime from that specific employee's own assigned ShiftTemplate.scheduled_hours
(a real per-employee/per-shift figure), not a single company-wide "standard
hours" constant like MiranErp's compute_overtime_hours — so this module
only sums those already-computed hours across a payroll run's date range
and converts them to pay using the company's OvertimeSettings.
"""

from decimal import Decimal

from apps.hr.models import AttendanceRecord


def compute_overtime_hours(employee, start_date, end_date):
    """Total overtime hours (a Decimal) across every AttendanceRecord
    with both clock_in and clock_out set, for one employee within
    [start_date, end_date] inclusive."""
    records = AttendanceRecord.objects.filter(
        employee=employee,
        date__gte=start_date,
        date__lte=end_date,
        clock_in__isnull=False,
        clock_out__isnull=False,
    )
    total = Decimal("0")
    for record in records:
        total += Decimal(str(record.overtime_hours))
    return total


def compute_overtime_pay_cents(employee, overtime_settings, start_date, end_date):
    """(overtime_hours, pay_cents) for one employee's payroll period,
    using the company's OvertimeSettings (assumed working days/month and
    rate multiplier) to derive an hourly rate from the employee's monthly
    effective_salary_cents."""
    hours = compute_overtime_hours(employee, start_date, end_date)
    if hours <= 0 or overtime_settings is None:
        return hours, 0
    monthly_hours = overtime_settings.standard_hours_per_day * overtime_settings.working_days_per_month
    if monthly_hours <= 0:
        return hours, 0
    hourly_rate_cents = Decimal(employee.effective_salary_cents) / monthly_hours
    pay_cents = int((hours * hourly_rate_cents * overtime_settings.rate_multiplier).to_integral_value())
    return hours, pay_cents
