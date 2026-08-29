from django.db import models

from apps.catalog.models import Item
from apps.common.models import TenantModel
from apps.inventory.models import StockMovement

# Section M: Healthcare — designed fresh, no MiranErp/Odoo source ported
# (neither project has a healthcare reference). Deliberately a thin real
# vertical slice, not a clinical system: no HL7/FHIR interoperability,
# no drug-interaction checking, no PACS imaging viewer, no crossmatch
# safety logic for blood compatibility — those are genuine
# safety-critical clinical subsystems this project has no business
# half-building. What's here is real and wired end to end: a patient's
# visit produces an EMR entry, a diagnostic order, a prescription that
# actually dispenses against real apps.inventory stock, and a bill.
#
# Patient is deliberately its OWN model, not reused from apps.crm.Customer
# the way Section J's Hotel guest, Section K's tenant/buyer, and Section
# L's retail customer all were — PHI (allergies, blood type, medical
# history) has no business living on the one shared CRM table every
# other vertical's staff can browse. This is the one section in the
# Phase 4 series that deliberately breaks the "reuse the core Customer
# concept" pattern, for a real reason, not by oversight.
#
# Several checklist items are folded into a shared model rather than
# given one each, the same restraint Section K's Property
# Rentals/Leasing merge and Section L's Returns/RMA non-split used:
# "Outpatient Management" / "Emergency Management" / "Operating Room"
# are Appointment.visit_type values, not separate booking systems;
# "Laboratory" / "Radiology" are DiagnosticOrder.type values, not two
# near-identical order tables; "Medical Inventory" is just
# apps.inventory/apps.catalog, the same reuse Section L made of the
# catalog for retail products; "Blood Bank" tracks request-and-fulfill
# as state on BloodUnit itself (reserve/use/discard), not a separate
# request model.


class Patient(TenantModel):
    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other"

    class BloodType(models.TextChoices):
        A_POS = "a+", "A+"
        A_NEG = "a-", "A-"
        B_POS = "b+", "B+"
        B_NEG = "b-", "B-"
        AB_POS = "ab+", "AB+"
        AB_NEG = "ab-", "AB-"
        O_POS = "o+", "O+"
        O_NEG = "o-", "O-"

    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=16, choices=Gender.choices, blank=True)
    blood_type = models.CharField(max_length=8, choices=BloodType.choices, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    address = models.CharField(max_length=255, blank=True)
    allergies = models.CharField(max_length=255, blank=True)
    emergency_contact_name = models.CharField(max_length=150, blank=True)
    emergency_contact_phone = models.CharField(max_length=32, blank=True)

    class Meta:
        db_table = "healthcare_patients"
        ordering = ["last_name", "first_name"]

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class MedicalStaff(TenantModel):
    """A Doctor or Nurse — "Doctor Management" and "Nurse Management" are
    both this one roster, filtered by `role`, the same way Appointment's
    visit_type folds four checklist items into one field rather than
    four tables. May or may not be an internal HR Employee (a visiting/
    consulting doctor is common), so `employee` is optional — the same
    shape Section K's SalesAgent uses for external agents."""

    class Role(models.TextChoices):
        DOCTOR = "doctor", "Doctor"
        NURSE = "nurse", "Nurse"

    employee = models.ForeignKey(
        "hr.Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    role = models.CharField(max_length=16, choices=Role.choices)
    name = models.CharField(max_length=255)
    specialization = models.CharField(max_length=150, blank=True)
    license_number = models.CharField(max_length=64, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_medical_staff"
        ordering = ["name"]

    def __str__(self):
        return f"{self.get_role_display()} {self.name}"


class Appointment(TenantModel):
    class VisitType(models.TextChoices):
        OUTPATIENT = "outpatient", "Outpatient"
        INPATIENT = "inpatient", "Inpatient"
        EMERGENCY = "emergency", "Emergency"
        SURGERY = "surgery", "Surgery"

    class Status(models.TextChoices):
        SCHEDULED = "scheduled", "Scheduled"
        CHECKED_IN = "checked_in", "Checked in"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        NO_SHOW = "no_show", "No-show"

    patient = models.ForeignKey(Patient, on_delete=models.PROTECT, related_name="appointments")
    staff = models.ForeignKey(MedicalStaff, on_delete=models.PROTECT, related_name="appointments")
    visit_type = models.CharField(max_length=16, choices=VisitType.choices, default=VisitType.OUTPATIENT)
    scheduled_at = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField(default=30)
    # Doubles as the operating room number when visit_type=surgery — no
    # separate OperatingRoom model for a field this thin.
    room = models.CharField(max_length=50, blank=True)
    reason = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.SCHEDULED)

    class Meta:
        db_table = "healthcare_appointments"
        ordering = ["-scheduled_at"]

    def __str__(self):
        return f"{self.patient} — {self.staff} ({self.scheduled_at:%Y-%m-%d %H:%M})"


class MedicalRecord(TenantModel):
    """One EMR entry. A patient's "Medical History" is just their list
    of these, ordered by date — not a separate summarized model."""

    patient = models.ForeignKey(Patient, on_delete=models.PROTECT, related_name="medical_records")
    appointment = models.ForeignKey(
        Appointment, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    recorded_by = models.ForeignKey(MedicalStaff, on_delete=models.PROTECT, related_name="+")
    record_date = models.DateField()
    diagnosis = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    blood_pressure = models.CharField(max_length=20, blank=True, help_text="e.g. 120/80")
    temperature_celsius = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    pulse_bpm = models.PositiveIntegerField(null=True, blank=True)
    weight_kg = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)

    class Meta:
        db_table = "healthcare_medical_records"
        ordering = ["-record_date", "-created_at"]

    def __str__(self):
        return f"{self.patient} — {self.record_date}"


class DiagnosticOrder(TenantModel):
    class Type(models.TextChoices):
        LAB = "lab", "Laboratory"
        IMAGING = "imaging", "Radiology / Imaging"

    class Status(models.TextChoices):
        ORDERED = "ordered", "Ordered"
        IN_PROGRESS = "in_progress", "In progress"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    patient = models.ForeignKey(Patient, on_delete=models.PROTECT, related_name="diagnostic_orders")
    doctor = models.ForeignKey(MedicalStaff, on_delete=models.PROTECT, related_name="+")
    medical_record = models.ForeignKey(
        MedicalRecord, on_delete=models.SET_NULL, null=True, blank=True, related_name="diagnostic_orders"
    )
    type = models.CharField(max_length=16, choices=Type.choices)
    test_name = models.CharField(max_length=255)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ORDERED)
    ordered_date = models.DateField()
    result_text = models.TextField(blank=True)
    result_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "healthcare_diagnostic_orders"
        ordering = ["-ordered_date", "-created_at"]

    def __str__(self):
        return f"{self.get_type_display()}: {self.test_name} — {self.patient}"


class Prescription(TenantModel):
    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        FILLED = "filled", "Filled"
        CANCELLED = "cancelled", "Cancelled"

    number = models.CharField(max_length=20)
    patient = models.ForeignKey(Patient, on_delete=models.PROTECT, related_name="prescriptions")
    doctor = models.ForeignKey(MedicalStaff, on_delete=models.PROTECT, related_name="+")
    medical_record = models.ForeignKey(
        MedicalRecord, on_delete=models.SET_NULL, null=True, blank=True, related_name="prescriptions"
    )
    prescribed_date = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)

    class Meta:
        db_table = "healthcare_prescriptions"
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_company_prescription_number")
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return self.number


class PrescriptionLine(TenantModel):
    """One medication on a Prescription — "Pharmacy". `item` is a plain
    apps.catalog.Item (the same "medical inventory" checklist item is
    just apps.inventory/apps.catalog, no dedicated model — see this
    module's own docstring). `movement` stays null until
    PrescriptionViewSet.dispense actually issues the medication as a
    real OUT StockMovement; a prescribed-but-not-yet-dispensed line has
    no movement at all, the same "only exists once the real event
    happened" shape apps.manufacturing.MaterialConsumption follows.
    """

    prescription = models.ForeignKey(Prescription, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name="+")
    quantity = models.PositiveIntegerField()
    dosage_instructions = models.CharField(max_length=255, blank=True)
    movement = models.ForeignKey(StockMovement, on_delete=models.PROTECT, null=True, blank=True, related_name="+")

    class Meta:
        db_table = "healthcare_prescription_lines"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.quantity} x {self.item} ({self.prescription})"


class Bed(TenantModel):
    class Status(models.TextChoices):
        AVAILABLE = "available", "Available"
        OCCUPIED = "occupied", "Occupied"
        MAINTENANCE = "maintenance", "Under maintenance"

    ward = models.CharField(max_length=100)
    bed_number = models.CharField(max_length=20)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.AVAILABLE)

    class Meta:
        db_table = "healthcare_beds"
        constraints = [
            models.UniqueConstraint(fields=["company", "ward", "bed_number"], name="unique_company_ward_bed_number")
        ]
        ordering = ["ward", "bed_number"]

    def __str__(self):
        return f"{self.ward} — {self.bed_number}"


class Admission(TenantModel):
    """Inpatient Management. The admission event itself is `created_at`
    (inherited from TenantModel) — no separate admitted_at field, the
    same "don't add a field that duplicates created_at" restraint
    apps.manufacturing.QualityCheck applies by reusing created_at
    instead of its own checked_at."""

    class Status(models.TextChoices):
        ADMITTED = "admitted", "Admitted"
        DISCHARGED = "discharged", "Discharged"

    number = models.CharField(max_length=20)
    patient = models.ForeignKey(Patient, on_delete=models.PROTECT, related_name="admissions")
    bed = models.ForeignKey(Bed, on_delete=models.PROTECT, related_name="admissions")
    admitting_doctor = models.ForeignKey(MedicalStaff, on_delete=models.PROTECT, related_name="+")
    reason = models.CharField(max_length=255, blank=True)
    discharged_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ADMITTED)

    class Meta:
        db_table = "healthcare_admissions"
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_company_admission_number")
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return self.number


class InsuranceProvider(TenantModel):
    name = models.CharField(max_length=255)
    contact_phone = models.CharField(max_length=32, blank=True)
    contact_email = models.EmailField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_insurance_providers"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_insurance_provider_name")
        ]
        ordering = ["name"]

    def __str__(self):
        return self.name


class PatientInsurance(TenantModel):
    patient = models.ForeignKey(Patient, on_delete=models.PROTECT, related_name="insurances")
    provider = models.ForeignKey(InsuranceProvider, on_delete=models.PROTECT, related_name="+")
    policy_number = models.CharField(max_length=100)
    coverage_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "healthcare_patient_insurances"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.patient} — {self.provider} ({self.policy_number})"


class MedicalBill(TenantModel):
    """Billing + Insurance. Deliberately internal-only, not posted to
    apps.accounting's general ledger — the same restraint
    apps.manufacturing's production costing and apps.retail's sale
    totals both apply; a real GL integration is a natural follow-up
    once a company actually needs the books to reflect it, not bundled
    in speculatively here."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        PARTIALLY_PAID = "partially_paid", "Partially paid"
        PAID = "paid", "Paid"

    number = models.CharField(max_length=20)
    patient = models.ForeignKey(Patient, on_delete=models.PROTECT, related_name="bills")
    admission = models.ForeignKey(Admission, on_delete=models.SET_NULL, null=True, blank=True, related_name="bills")
    appointment = models.ForeignKey(
        Appointment, on_delete=models.SET_NULL, null=True, blank=True, related_name="bills"
    )
    patient_insurance = models.ForeignKey(
        PatientInsurance, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    subtotal_cents = models.BigIntegerField(default=0)
    insurance_covered_cents = models.BigIntegerField(default=0)
    patient_owed_cents = models.BigIntegerField(default=0)
    paid_amount_cents = models.BigIntegerField(default=0)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)

    class Meta:
        db_table = "healthcare_medical_bills"
        constraints = [
            models.UniqueConstraint(fields=["company", "number"], name="unique_company_medical_bill_number")
        ]
        ordering = ["-created_at"]

    def __str__(self):
        return self.number


class MedicalBillLine(TenantModel):
    bill = models.ForeignKey(MedicalBill, on_delete=models.CASCADE, related_name="lines")
    description = models.CharField(max_length=255)
    amount_cents = models.BigIntegerField()

    class Meta:
        db_table = "healthcare_medical_bill_lines"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.description} — {self.amount_cents}"


class BloodUnit(TenantModel):
    """Blood Bank. Tracks a physical unit's own lifecycle
    (available -> reserved -> used, or expired/discarded) rather than
    a separate request-and-fulfill model — reserving a unit for a
    patient (see BloodUnitViewSet.reserve) *is* the request, the same
    way apps.realestate.PropertySale flips its own Unit to reserved
    rather than a separate reservation record. Deliberately no
    donor-eligibility or crossmatch/compatibility-testing logic — real
    clinical safety systems this project has no business half-building
    (see this module's own top docstring)."""

    class BloodType(models.TextChoices):
        A_POS = "a+", "A+"
        A_NEG = "a-", "A-"
        B_POS = "b+", "B+"
        B_NEG = "b-", "B-"
        AB_POS = "ab+", "AB+"
        AB_NEG = "ab-", "AB-"
        O_POS = "o+", "O+"
        O_NEG = "o-", "O-"

    class Status(models.TextChoices):
        AVAILABLE = "available", "Available"
        RESERVED = "reserved", "Reserved"
        USED = "used", "Used"
        EXPIRED = "expired", "Expired"
        DISCARDED = "discarded", "Discarded"

    blood_type = models.CharField(max_length=8, choices=BloodType.choices)
    volume_ml = models.PositiveIntegerField(default=450)
    collected_date = models.DateField()
    expiry_date = models.DateField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.AVAILABLE)
    reserved_for = models.ForeignKey(Patient, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    notes = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = "healthcare_blood_units"
        ordering = ["blood_type", "expiry_date"]

    def __str__(self):
        return f"{self.get_blood_type_display()} — {self.volume_ml}ml ({self.status})"
