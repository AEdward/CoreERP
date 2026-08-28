"""Leave balance computation, isolated from the HTTP layer. "Used" counts
SUBMITTED and APPROVED requests together (not just APPROVED) — the
apps.approvals equivalent of MiranErp's PENDING+APPROVED — so two
overlapping still-deciding requests can't silently both get approved past
the annual allocation later. DRAFT/REJECTED/CANCELLED never count.
"""

from .models import LeaveRequest


def compute_leave_balance(employee, leave_type, year, exclude_id=None):
    qs = LeaveRequest.objects.filter(
        employee=employee,
        leave_type=leave_type,
        start_date__year=year,
        status__in=[LeaveRequest.Status.SUBMITTED, LeaveRequest.Status.APPROVED],
    )
    if exclude_id:
        qs = qs.exclude(id=exclude_id)
    used = sum(lr.days for lr in qs)
    allocated = leave_type.default_days_per_year
    return {"allocated": allocated, "used": used, "remaining": allocated - used}
