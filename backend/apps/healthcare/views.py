from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.auditlog.models import AuditLog
from apps.auditlog.services import log_audit
from apps.common.views import CompanyScopedViewSet
from apps.inventory.models import StockMovement
from apps.inventory.serializers import StockMovementSerializer

from .models import (
    Admission,
    Appointment,
    Bed,
    BloodUnit,
    DiagnosticOrder,
    InsuranceProvider,
    MedicalBill,
    MedicalRecord,
    MedicalStaff,
    Patient,
    PatientInsurance,
    Prescription,
)
from .serializers import (
    AdmissionSerializer,
    AppointmentSerializer,
    BedSerializer,
    BloodUnitSerializer,
    DiagnosticOrderSerializer,
    InsuranceProviderSerializer,
    MedicalBillSerializer,
    MedicalRecordSerializer,
    MedicalStaffSerializer,
    PatientInsuranceSerializer,
    PatientSerializer,
    PrescriptionSerializer,
)


class PatientViewSet(CompanyScopedViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    permission_module = "healthcare"


class MedicalStaffViewSet(CompanyScopedViewSet):
    queryset = MedicalStaff.objects.select_related("employee").all()
    serializer_class = MedicalStaffSerializer
    permission_module = "healthcare"

    def get_queryset(self):
        qs = super().get_queryset()
        role = self.request.query_params.get("role")
        if role:
            qs = qs.filter(role=role)
        return qs


class AppointmentViewSet(CompanyScopedViewSet):
    queryset = Appointment.objects.select_related("patient", "staff").all()
    serializer_class = AppointmentSerializer
    permission_module = "healthcare"

    def get_queryset(self):
        qs = super().get_queryset()
        patient_id = self.request.query_params.get("patient")
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs

    def _transition(self, request, allowed_from, new_status):
        appointment = self.get_object()
        if appointment.status not in allowed_from:
            raise ValidationError(f"Can't move an appointment from {appointment.status} to {new_status}.")
        appointment.status = new_status
        appointment.save(update_fields=["status"])
        return Response(AppointmentSerializer(appointment).data)

    @action(detail=True, methods=["post"])
    def check_in(self, request, pk=None):
        return self._transition(request, [Appointment.Status.SCHEDULED], Appointment.Status.CHECKED_IN)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        return self._transition(
            request, [Appointment.Status.SCHEDULED, Appointment.Status.CHECKED_IN], Appointment.Status.COMPLETED
        )

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return self._transition(
            request, [Appointment.Status.SCHEDULED, Appointment.Status.CHECKED_IN], Appointment.Status.CANCELLED
        )

    @action(detail=True, methods=["post"])
    def no_show(self, request, pk=None):
        return self._transition(request, [Appointment.Status.SCHEDULED], Appointment.Status.NO_SHOW)


class MedicalRecordViewSet(CompanyScopedViewSet):
    queryset = MedicalRecord.objects.select_related("patient", "recorded_by").all()
    serializer_class = MedicalRecordSerializer
    permission_module = "healthcare"

    def get_queryset(self):
        qs = super().get_queryset()
        patient_id = self.request.query_params.get("patient")
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs


class DiagnosticOrderViewSet(CompanyScopedViewSet):
    queryset = DiagnosticOrder.objects.select_related("patient", "doctor").all()
    serializer_class = DiagnosticOrderSerializer
    permission_module = "healthcare"

    def get_queryset(self):
        qs = super().get_queryset()
        patient_id = self.request.query_params.get("patient")
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        order = self.get_object()
        if order.status == DiagnosticOrder.Status.COMPLETED:
            raise ValidationError("This order is already completed.")
        order.result_text = request.data.get("result_text", "")
        order.result_date = timezone.localdate()
        order.status = DiagnosticOrder.Status.COMPLETED
        order.save(update_fields=["result_text", "result_date", "status"])
        return Response(DiagnosticOrderSerializer(order).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        order = self.get_object()
        if order.status == DiagnosticOrder.Status.COMPLETED:
            raise ValidationError("A completed order can't be cancelled.")
        order.status = DiagnosticOrder.Status.CANCELLED
        order.save(update_fields=["status"])
        return Response(DiagnosticOrderSerializer(order).data)


class PrescriptionViewSet(CompanyScopedViewSet):
    queryset = Prescription.objects.select_related("patient", "doctor").prefetch_related("lines__item")
    serializer_class = PrescriptionSerializer
    permission_module = "healthcare"

    def get_queryset(self):
        qs = super().get_queryset()
        patient_id = self.request.query_params.get("patient")
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs

    @action(detail=True, methods=["post"])
    def dispense(self, request, pk=None):
        """Issues every not-yet-dispensed line as a real OUT
        StockMovement from `warehouse` — the same StockMovementSerializer
        every other stock-moving feature in this project goes through,
        so an understocked medication is rejected by that serializer's
        own check, not re-validated here."""
        prescription = self.get_object()
        if prescription.status != Prescription.Status.ACTIVE:
            raise ValidationError("Only an active prescription can be dispensed.")
        warehouse_id = request.data.get("warehouse")
        if not warehouse_id:
            raise ValidationError({"warehouse": "Required."})

        pending_lines = [line for line in prescription.lines.all() if line.movement_id is None]
        if not pending_lines:
            raise ValidationError("Nothing left to dispense on this prescription.")

        for line in pending_lines:
            movement_serializer = StockMovementSerializer(
                data={
                    "item": line.item_id,
                    "warehouse": warehouse_id,
                    "type": StockMovement.MovementType.OUT,
                    "quantity": line.quantity,
                    "reference": f"{prescription.number} dispensed",
                },
                context={"request": request},
            )
            movement_serializer.is_valid(raise_exception=True)
            movement = movement_serializer.save(company=prescription.company)
            log_audit(request, movement, AuditLog.Action.CREATED)
            line.movement = movement
            line.save(update_fields=["movement"])

        prescription.status = Prescription.Status.FILLED
        prescription.save(update_fields=["status"])
        prescription.refresh_from_db()
        return Response(PrescriptionSerializer(prescription).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        prescription = self.get_object()
        if prescription.status != Prescription.Status.ACTIVE:
            raise ValidationError("Only an active prescription can be cancelled.")
        prescription.status = Prescription.Status.CANCELLED
        prescription.save(update_fields=["status"])
        return Response(PrescriptionSerializer(prescription).data)


class BedViewSet(CompanyScopedViewSet):
    queryset = Bed.objects.all()
    serializer_class = BedSerializer
    permission_module = "healthcare"


class AdmissionViewSet(CompanyScopedViewSet):
    queryset = Admission.objects.select_related("patient", "bed", "admitting_doctor").all()
    serializer_class = AdmissionSerializer
    permission_module = "healthcare"

    def get_queryset(self):
        qs = super().get_queryset()
        patient_id = self.request.query_params.get("patient")
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs

    @action(detail=True, methods=["post"])
    def discharge(self, request, pk=None):
        admission = self.get_object()
        if admission.status != Admission.Status.ADMITTED:
            raise ValidationError("This admission is already discharged.")
        admission.status = Admission.Status.DISCHARGED
        admission.discharged_at = timezone.now()
        admission.save(update_fields=["status", "discharged_at"])
        admission.bed.status = Bed.Status.AVAILABLE
        admission.bed.save(update_fields=["status"])
        return Response(AdmissionSerializer(admission).data)


class InsuranceProviderViewSet(CompanyScopedViewSet):
    queryset = InsuranceProvider.objects.all()
    serializer_class = InsuranceProviderSerializer
    permission_module = "healthcare"


class PatientInsuranceViewSet(CompanyScopedViewSet):
    queryset = PatientInsurance.objects.select_related("patient", "provider").all()
    serializer_class = PatientInsuranceSerializer
    permission_module = "healthcare"

    def get_queryset(self):
        qs = super().get_queryset()
        patient_id = self.request.query_params.get("patient")
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs


class MedicalBillViewSet(CompanyScopedViewSet):
    queryset = MedicalBill.objects.select_related("patient", "patient_insurance").prefetch_related("lines")
    serializer_class = MedicalBillSerializer
    permission_module = "healthcare"

    def get_queryset(self):
        qs = super().get_queryset()
        patient_id = self.request.query_params.get("patient")
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs

    @action(detail=True, methods=["post"])
    def record_payment(self, request, pk=None):
        bill = self.get_object()
        if bill.status == MedicalBill.Status.PAID:
            raise ValidationError("This bill is already fully paid.")
        amount = request.data.get("amount_cents") or 0
        if amount <= 0:
            raise ValidationError({"amount_cents": "Must be a positive whole number."})
        if bill.paid_amount_cents + amount > bill.patient_owed_cents:
            raise ValidationError({"amount_cents": "Exceeds the amount owed by the patient."})
        bill.paid_amount_cents += amount
        bill.status = (
            MedicalBill.Status.PAID
            if bill.paid_amount_cents >= bill.patient_owed_cents
            else MedicalBill.Status.PARTIALLY_PAID
        )
        bill.save(update_fields=["paid_amount_cents", "status"])
        return Response(MedicalBillSerializer(bill).data)


class BloodUnitViewSet(CompanyScopedViewSet):
    queryset = BloodUnit.objects.select_related("reserved_for").all()
    serializer_class = BloodUnitSerializer
    permission_module = "healthcare"

    def get_queryset(self):
        qs = super().get_queryset()
        blood_type = self.request.query_params.get("blood_type")
        if blood_type:
            qs = qs.filter(blood_type=blood_type)
        status_param = self.request.query_params.get("status")
        if status_param:
            qs = qs.filter(status=status_param)
        return qs

    @action(detail=True, methods=["post"])
    def reserve(self, request, pk=None):
        unit = self.get_object()
        if unit.status != BloodUnit.Status.AVAILABLE:
            raise ValidationError("This unit isn't available.")
        patient_id = request.data.get("patient")
        if not patient_id:
            raise ValidationError({"patient": "Required."})
        patient = Patient.objects.filter(company=unit.company, pk=patient_id).first()
        if not patient:
            raise ValidationError({"patient": "Must belong to the active company."})
        unit.status = BloodUnit.Status.RESERVED
        unit.reserved_for = patient
        unit.save(update_fields=["status", "reserved_for"])
        return Response(BloodUnitSerializer(unit).data)

    @action(detail=True, methods=["post"])
    def use(self, request, pk=None):
        unit = self.get_object()
        if unit.status != BloodUnit.Status.RESERVED:
            raise ValidationError("Only a reserved unit can be marked used.")
        unit.status = BloodUnit.Status.USED
        unit.save(update_fields=["status"])
        return Response(BloodUnitSerializer(unit).data)

    @action(detail=True, methods=["post"])
    def discard(self, request, pk=None):
        unit = self.get_object()
        if unit.status in (BloodUnit.Status.USED, BloodUnit.Status.DISCARDED):
            raise ValidationError("This unit can no longer be discarded.")
        unit.status = BloodUnit.Status.DISCARDED
        unit.notes = request.data.get("reason", unit.notes)
        unit.save(update_fields=["status", "notes"])
        return Response(BloodUnitSerializer(unit).data)
