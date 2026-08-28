from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.branches.models import Branch
from apps.common.models import TenantModel
from apps.costcenters.models import CostCenter


class Department(TenantModel):
    name = models.CharField(max_length=100)
    branch = models.ForeignKey(
        Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name="departments"
    )

    class Meta:
        db_table = "departments"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_department_name")
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class Position(TenantModel):
    """Closes the module map's "(partial) Positions" gap — promotes
    Employee's old free-text `position` field to a real, reusable entity
    (so "Sales Manager" is one thing, not a slightly different string per
    employee who holds it)."""

    title = models.CharField(max_length=100)
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="positions"
    )

    class Meta:
        db_table = "positions"
        constraints = [
            models.UniqueConstraint(fields=["company", "title"], name="unique_company_position_title")
        ]
        ordering = ["title"]

    def __str__(self):
        return self.title


class ShiftTemplate(TenantModel):
    """A named work schedule (e.g. "Day Shift" 08:00-17:00) an Employee
    can be assigned to. Deliberately just one shift per employee at a
    time (Employee.shift below), not a rotation/roster system — a real
    shift-rotation scheduler is a substantially bigger feature than what
    "Shift Management" needs to unblock Attendance/Overtime math."""

    name = models.CharField(max_length=100)
    start_time = models.TimeField()
    end_time = models.TimeField()
    break_minutes = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "shift_templates"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_shift_name")
        ]
        ordering = ["name"]

    @property
    def scheduled_hours(self):
        start = self.start_time.hour * 60 + self.start_time.minute
        end = self.end_time.hour * 60 + self.end_time.minute
        minutes = (end - start) if end > start else (end + 24 * 60 - start)
        return max(minutes - self.break_minutes, 0) / 60

    def __str__(self):
        return f"{self.name} ({self.start_time}–{self.end_time})"


class SalaryStructure(TenantModel):
    """A named pay grade/band ("Grade 3") with a standard base salary —
    everyone assigned to the same structure earns the same base rate,
    rather than each employee's `salary_cents` being independently typed.
    `description` is free text for whatever standard allowances the grade
    implies in practice (e.g. "includes housing + transport") —
    SalaryComponent (apps.payroll) is still the itemized-components
    table; a structure just names the pay band, it doesn't try to also
    be that."""

    name = models.CharField(max_length=100)
    base_salary_cents = models.BigIntegerField(default=0)
    description = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "salary_structures"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_salary_structure_name")
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class Employee(TenantModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        ON_LEAVE = "on_leave", "On leave"
        TERMINATED = "terminated", "Terminated"

    class PaymentMethod(models.TextChoices):
        BANK_TRANSFER = "bank_transfer", "Bank transfer"
        CASH = "cash", "Cash"
        MOBILE_MONEY = "mobile_money", "Mobile money"

    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other"

    class MaritalStatus(models.TextChoices):
        SINGLE = "single", "Single"
        MARRIED = "married", "Married"
        DIVORCED = "divorced", "Divorced"
        WIDOWED = "widowed", "Widowed"

    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    position = models.ForeignKey(
        Position, on_delete=models.SET_NULL, null=True, blank=True, related_name="employees"
    )
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="employees"
    )
    branch = models.ForeignKey(
        Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name="employees"
    )
    shift = models.ForeignKey(
        ShiftTemplate, on_delete=models.SET_NULL, null=True, blank=True, related_name="employees"
    )
    cost_center = models.ForeignKey(
        CostCenter, on_delete=models.SET_NULL, null=True, blank=True, related_name="employees"
    )
    salary_structure = models.ForeignKey(
        SalaryStructure, on_delete=models.SET_NULL, null=True, blank=True, related_name="employees"
    )
    # Org hierarchy — who this employee reports to. Self-referential and
    # nullable (a GM/Owner-level employee reports to no one). Data model
    # only — not wired into any approval-routing logic, that would need
    # a concrete trigger of its own.
    manager = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="direct_reports"
    )
    salary_cents = models.BigIntegerField(default=0)
    joining_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="employee_profiles",
        help_text="The platform account this employee record belongs to, if any — links this "
        "record to Employee Self-Service. Set by HR, not the employee themselves.",
    )

    # Payroll disbursement
    payment_method = models.CharField(
        max_length=16, choices=PaymentMethod.choices, default=PaymentMethod.BANK_TRANSFER
    )
    bank_name = models.CharField(max_length=100, blank=True)
    bank_account_number = models.CharField(max_length=64, blank=True)
    bank_account_name = models.CharField(max_length=150, blank=True)

    # Personal / statutory
    national_id = models.CharField(max_length=64, blank=True)
    passport_number = models.CharField(max_length=64, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=16, choices=Gender.choices, blank=True)
    marital_status = models.CharField(max_length=16, choices=MaritalStatus.choices, blank=True)
    address = models.CharField(max_length=255, blank=True)
    emergency_contact_name = models.CharField(max_length=150, blank=True)
    emergency_contact_phone = models.CharField(max_length=32, blank=True)

    class Meta:
        db_table = "employees"
        ordering = ["last_name", "first_name"]
        constraints = [
            models.UniqueConstraint(fields=["company", "user"], name="unique_company_employee_user")
        ]

    @property
    def effective_salary_cents(self):
        """The number payroll actually pays: a structure's grade rate
        when one's assigned, the individually-typed salary_cents
        otherwise. apps.payroll.engine reads this rather than
        salary_cents directly, so a company using pay grades gets the
        grade rate automatically and one not using them at all keeps
        working exactly as before."""
        if self.salary_structure_id:
            return self.salary_structure.base_salary_cents
        return self.salary_cents

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class Skill(TenantModel):
    """A per-company reference skill (e.g. "Python", "Forklift
    Operation") — designed fresh, Odoo-inspired: neither MiranErp nor
    CoreERP has a skills matrix. Kept as a real lookup table rather than
    free text on `EmployeeSkill` for the same reason `LeaveType`/
    `SalaryComponent` are real tables — a matrix report grouping by
    skill only works if the name is consistent across employees, not
    whatever each entry happened to be typed as."""

    name = models.CharField(max_length=100)
    category = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = "hr_skills"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_skill_name")
        ]
        ordering = ["category", "name"]

    def __str__(self):
        return self.name


class EmployeeSkill(TenantModel):
    """One employee's proficiency in one Skill — the actual matrix
    entry. A resume/CV itself isn't a field here or on Employee: it
    attaches via the existing generic Documents panel already available
    on every Employee record (`hr.employee` is already in
    apps.common.targeting.ALLOWED_TARGETS), the same "one file-storage
    mechanism project-wide" choice EmployeeContract/EmployeeDocument
    already made, rather than adding a second, redundant upload slot."""

    class Proficiency(models.TextChoices):
        BEGINNER = "beginner", "Beginner"
        INTERMEDIATE = "intermediate", "Intermediate"
        ADVANCED = "advanced", "Advanced"
        EXPERT = "expert", "Expert"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="skills")
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE, related_name="employee_skills")
    proficiency = models.CharField(max_length=16, choices=Proficiency.choices, default=Proficiency.BEGINNER)

    class Meta:
        db_table = "hr_employee_skills"
        constraints = [
            models.UniqueConstraint(fields=["employee", "skill"], name="unique_employee_skill")
        ]
        ordering = ["skill__category", "skill__name"]

    def __str__(self):
        return f"{self.employee} — {self.skill} ({self.get_proficiency_display()})"


class AttendanceRecord(TenantModel):
    """One employee's clock-in/out for one date. `source` distinguishes
    a manually-entered record from one that arrived via the bulk
    `/import/` endpoint — the realistic "software side" of Biometric
    Attendance: this project has no fingerprint/face-recognition hardware
    of its own (nor could it — that's a physical device + vendor SDK
    concern, not a code-completeness one), but real biometric devices
    universally export a log of clock events that HR imports in bulk,
    which this endpoint accepts. Overnight shifts (clock_out past
    midnight) aren't handled — a known simplification, same spirit as
    this project's other "correct and simple over sophisticated" calls."""

    class Status(models.TextChoices):
        PRESENT = "present", "Present"
        ABSENT = "absent", "Absent"
        LATE = "late", "Late"
        HALF_DAY = "half_day", "Half day"

    class Source(models.TextChoices):
        MANUAL = "manual", "Manual"
        DEVICE_IMPORT = "device_import", "Device import"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="attendance_records")
    date = models.DateField()
    clock_in = models.TimeField(null=True, blank=True)
    clock_out = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PRESENT)
    source = models.CharField(max_length=16, choices=Source.choices, default=Source.MANUAL)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "attendance_records"
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(fields=["employee", "date"], name="unique_employee_attendance_date")
        ]

    @property
    def worked_hours(self):
        if not self.clock_in or not self.clock_out:
            return 0
        start = self.clock_in.hour * 60 + self.clock_in.minute
        end = self.clock_out.hour * 60 + self.clock_out.minute
        minutes = (end - start) if end > start else 0
        return round(minutes / 60, 2)

    @property
    def overtime_hours(self):
        shift = self.employee.shift
        if not shift:
            return 0
        return round(max(self.worked_hours - shift.scheduled_hours, 0), 2)

    def __str__(self):
        return f"{self.employee} — {self.date} ({self.get_status_display()})"


class EmployeeContract(TenantModel):
    """A real, concrete Section F gap: the formal record of an employee's
    contract terms over time (type, dates, salary at signing), separate
    from Employee.salary_cents which stays the single "current payroll
    figure" HR keeps up to date by hand — this doesn't auto-sync it, the
    same "record documents facts, doesn't auto-cascade" scope call Fixed
    Assets makes about the GL. Signed contract documents/scans attach via
    the existing generic Documents panel (registered in ALLOWED_TARGETS)."""

    class ContractType(models.TextChoices):
        PERMANENT = "permanent", "Permanent"
        FIXED_TERM = "fixed_term", "Fixed-term"
        PROBATION = "probation", "Probation"
        CONTRACTOR = "contractor", "Contractor"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="contracts")
    contract_type = models.CharField(
        max_length=16, choices=ContractType.choices, default=ContractType.PERMANENT
    )
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)  # blank = open-ended
    salary_cents = models.BigIntegerField(default=0)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = "employee_contracts"
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.employee} — {self.get_contract_type_display()} ({self.start_date})"


class EmployeeDocument(TenantModel):
    """Structured metadata for one employee document — ID scan, signed
    contract, certificate, work permit — with an optional expiry date
    the HR page's expiry-reminder widget queries against. Ported from
    MiranErp's EmployeeDocument, but adapted to this project's existing
    generic Documents panel instead of MiranErp's own `FileField`: the
    actual file attaches via that panel (`hr.employeedocument` registered
    in apps.common.targeting.ALLOWED_TARGETS), the same "record documents
    facts, the file itself attaches generically" pattern EmployeeContract
    already uses for its signed contract scan — one file-storage
    mechanism for the whole project rather than two competing ones."""

    class DocType(models.TextChoices):
        ID_CARD = "id_card", "ID Card"
        PASSPORT = "passport", "Passport"
        CONTRACT = "contract", "Contract"
        CERTIFICATE = "certificate", "Certificate"
        WORK_PERMIT = "work_permit", "Work Permit"
        HEALTH_CHECK = "health_check", "Health Check"
        OTHER = "other", "Other"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="documents")
    doc_type = models.CharField(max_length=16, choices=DocType.choices, default=DocType.OTHER)
    expiry_date = models.DateField(null=True, blank=True)
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "hr_employee_documents"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.employee} — {self.get_doc_type_display()}"


class Offboarding(TenantModel):
    """One record per employee's exit — OneToOne, since starting
    offboarding again for someone already fully offboarded isn't a real
    scenario this project needs to model (a rehire gets a fresh Employee
    row, not a reused old one). Creating this record does NOT itself
    change Employee.status — someone can be mid-notice and still
    actively working; only the explicit `complete` action, which
    requires all three clearances checked, flips the employee to
    TERMINATED. Ported from MiranErp's Offboarding. The "final
    settlement" figure is deliberately not a separate stored field —
    it's just that employee's most recent Payslip, already computed and
    already viewable on the Payroll page; duplicating it here would be a
    second source of truth for the same number."""

    class Reason(models.TextChoices):
        RESIGNATION = "resignation", "Resignation"
        TERMINATION = "termination", "Termination"
        RETIREMENT = "retirement", "Retirement"
        OTHER = "other", "Other"

    class Status(models.TextChoices):
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"

    employee = models.OneToOneField(Employee, on_delete=models.CASCADE, related_name="offboarding")
    reason = models.CharField(max_length=16, choices=Reason.choices, default=Reason.OTHER)
    resignation_date = models.DateField()
    last_working_day = models.DateField()
    exit_interview_notes = models.TextField(blank=True)
    clearance_it = models.BooleanField(default=False)
    clearance_finance = models.BooleanField(default=False)
    clearance_admin = models.BooleanField(default=False)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.IN_PROGRESS)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "hr_offboarding"

    def __str__(self):
        return f"{self.employee} — {self.get_reason_display()} ({self.status})"


class ShiftAssignment(TenantModel):
    """One employee, one shift template, one date — the actual roster
    entry, replacing the static one-`shift`-FK-per-employee shape
    (`Employee.shift`) with a real per-date schedule. Ported from
    MiranErp. Unique per (company, employee, date): deliberately one
    shift per person per day, not a full multi-shift-per-day calendar —
    the same scope call `Employee.shift` already made, just spread
    across dates now instead of collapsed into "whatever their current
    shift is." `Employee.shift` itself is left in place as the default/
    fallback used by Attendance's overtime math when no dated assignment
    exists for that day — no need to force every company to build out a
    full roster before Attendance/Overtime keeps working."""

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="shift_assignments")
    shift_template = models.ForeignKey(ShiftTemplate, on_delete=models.PROTECT, related_name="assignments")
    date = models.DateField()
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "hr_shift_assignments"
        constraints = [
            models.UniqueConstraint(fields=["company", "employee", "date"], name="unique_employee_shift_day")
        ]
        ordering = ["date"]

    def __str__(self):
        return f"{self.employee} — {self.shift_template.name} on {self.date}"


class ShiftSwapRequest(TenantModel):
    """A request to hand one existing ShiftAssignment off to a different
    employee — the common "can someone cover my shift" case, not a
    strict two-way trade. Ported from MiranErp: HR/a manager records and
    approves/rejects these, the same admin-managed-workflow shape
    LeaveRequest establishes, rather than routing through
    apps.selfservice — a swap is between two specific employees and
    needs a human arbiter regardless of who initiated it, unlike a
    single employee's own leave request. Approving reassigns the
    underlying ShiftAssignment's employee; the assignment's date/shift
    stay the same, only who's covering it changes."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"

    assignment = models.ForeignKey(ShiftAssignment, on_delete=models.CASCADE, related_name="swap_requests")
    proposed_employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="+")
    reason = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "hr_shift_swap_requests"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.assignment} -> {self.proposed_employee} ({self.status})"


class LeaveType(TenantModel):
    """Per-company config, e.g. "Annual Leave", "Sick Leave" — same shape
    as apps.expenses' category free text would have been, but this one's
    worth a real lookup table since LeaveRequest needs to reference it.
    `default_days_per_year` is the entitlement apps.hr.leave_balance draws
    down against — 0 means "no tracked allocation," same "opt in, don't
    force a number" shape apps.tax.TaxRate's own per-item opt-in follows.

    `accrual_enabled` switches that flat annual entitlement for a
    monthly accrual-to-date model instead — designed fresh, no MiranErp
    or Odoo reference to port (both only offer flat entitlements): when
    on, apps.hr.leave_balance.compute_leave_balance ignores
    `default_days_per_year` and instead allocates
    `accrual_rate_days_per_month` for each complete month elapsed so far
    this year (truncated to whole days — partial-day accrual isn't
    usable until it completes a whole day), plus whatever unused balance
    carried over from the previous year capped at `carryover_cap_days`
    (0 = no carryover, the same "0 opts out" convention
    `default_days_per_year` already uses). Carryover only looks back one
    year — it does not recursively chain further back through every
    prior year's own carryover, a deliberate simplification since this
    project has no year-end close process that would make multi-year
    chaining meaningful anyway."""

    name = models.CharField(max_length=100)
    paid = models.BooleanField(default=True)
    default_days_per_year = models.PositiveIntegerField(default=0)
    accrual_enabled = models.BooleanField(default=False)
    accrual_rate_days_per_month = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("0.00"))
    carryover_cap_days = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "leave_types"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_leave_type_name")
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class PublicHoliday(TenantModel):
    """A calendar date that doesn't count against any leave allocation
    even when it falls inside an approved leave request's date range —
    designed fresh (no MiranErp/Odoo model ported), the minimum viable
    "company holiday calendar" needed to keep LeaveRequest.days honest
    without building a full calendar/scheduling module for it."""

    name = models.CharField(max_length=100)
    date = models.DateField()

    class Meta:
        db_table = "hr_public_holidays"
        constraints = [
            models.UniqueConstraint(fields=["company", "date"], name="unique_company_public_holiday_date")
        ]
        ordering = ["date"]

    def __str__(self):
        return f"{self.name} ({self.date})"


class LeaveRequest(TenantModel):
    """Closes the module map's explicitly-flagged "Leave Management —
    real gap" item. Goes through apps.approvals the identical way
    Expense/PurchaseRequest/PurchaseOrder do (a fourth real consumer).

    Approving a request that covers today now flips Employee.status to
    ON_LEAVE (see apps.hr.apps.HrConfig.ready's on_decided hook) — no
    scheduled job needed for that part, it's a direct consequence of the
    decision itself. There's still no scheduler to flip it back
    automatically once the leave period simply ends, or forward once it
    starts if approved in advance — a known, deliberate gap, not an
    oversight, the same one MiranErp's own LeaveRequest documents.
    CANCELLED covers "employee returned early" / "the approval was a
    mistake" and reverts ON_LEAVE back to ACTIVE when it undoes the
    thing that set it."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SUBMITTED = "submitted", "Submitted"
        APPROVED = "approved", "Approved"
        REJECTED = "rejected", "Rejected"
        CANCELLED = "cancelled", "Cancelled"

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name="leave_requests")
    leave_type = models.ForeignKey(LeaveType, on_delete=models.PROTECT, related_name="+")
    start_date = models.DateField()
    end_date = models.DateField()
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)

    class Meta:
        db_table = "leave_requests"
        ordering = ["-start_date"]
        constraints = [
            models.CheckConstraint(
                check=models.Q(end_date__gte=models.F("start_date")), name="leave_end_after_start"
            )
        ]

    @property
    def days(self):
        total = (self.end_date - self.start_date).days + 1
        holidays = PublicHoliday.objects.filter(
            company_id=self.company_id, date__gte=self.start_date, date__lte=self.end_date
        ).count()
        return max(total - holidays, 0)

    def __str__(self):
        return f"{self.employee} — {self.leave_type} ({self.start_date} to {self.end_date})"
