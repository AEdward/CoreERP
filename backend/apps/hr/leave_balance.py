"""Leave balance computation, isolated from the HTTP layer. "Used" counts
SUBMITTED and APPROVED requests together (not just APPROVED) — the
apps.approvals equivalent of MiranErp's PENDING+APPROVED — so two
overlapping still-deciding requests can't silently both get approved past
the annual allocation later. DRAFT/REJECTED/CANCELLED never count.
"""

from django.utils import timezone

from .models import LeaveRequest


def _used_days(employee, leave_type, year, exclude_id=None):
    qs = LeaveRequest.objects.filter(
        employee=employee,
        leave_type=leave_type,
        start_date__year=year,
        status__in=[LeaveRequest.Status.SUBMITTED, LeaveRequest.Status.APPROVED],
    )
    if exclude_id:
        qs = qs.exclude(id=exclude_id)
    return sum(lr.days for lr in qs)


def _allocated_days(employee, leave_type, year, include_carryover=True):
    """Flat `default_days_per_year`, or — when `accrual_enabled` — a
    monthly accrual-to-date plus at most one year's carryover. Carryover
    intentionally looks back only one year (not recursively through
    every prior year's own carryover): this project has no year-end
    close process that would make chaining further back meaningful."""
    if not leave_type.accrual_enabled:
        allocated = leave_type.default_days_per_year
    else:
        today = timezone.localdate()
        if year < today.year:
            months_elapsed = 12
        elif year > today.year:
            months_elapsed = 0
        else:
            months_elapsed = today.month
        allocated = int(leave_type.accrual_rate_days_per_month * months_elapsed)

    if include_carryover and leave_type.carryover_cap_days:
        prev_allocated = _allocated_days(employee, leave_type, year - 1, include_carryover=False)
        prev_used = _used_days(employee, leave_type, year - 1)
        carryover = min(max(prev_allocated - prev_used, 0), leave_type.carryover_cap_days)
        allocated += carryover

    return allocated


def compute_leave_balance(employee, leave_type, year, exclude_id=None):
    used = _used_days(employee, leave_type, year, exclude_id=exclude_id)
    allocated = _allocated_days(employee, leave_type, year)
    return {"allocated": allocated, "used": used, "remaining": allocated - used}
