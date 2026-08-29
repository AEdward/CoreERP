from django.db import transaction
from rest_framework import serializers

from apps.common.numbering import next_number
from apps.common.serializers import CompanyScopedSerializer

from .models import (
    Admission,
    Appointment,
    Bed,
    BloodUnit,
    DiagnosticOrder,
    InsuranceProvider,
    MedicalBill,
    MedicalBillLine,
    MedicalRecord,
    MedicalStaff,
    Patient,
    PatientInsurance,
    Prescription,
    PrescriptionLine,
)


class PatientSerializer(CompanyScopedSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            "id",
            "first_name",
            "last_name",
            "name",
            "date_of_birth",
            "gender",
            "blood_type",
            "phone",
            "email",
            "address",
            "allergies",
            "emergency_contact_name",
            "emergency_contact_phone",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"


class MedicalStaffSerializer(CompanyScopedSerializer):
    same_company_fields = ["employee"]
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = MedicalStaff
        fields = [
            "id",
            "employee",
            "employee_name",
            "role",
            "name",
            "specialization",
            "license_number",
            "phone",
            "email",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_employee_name(self, obj):
        return str(obj.employee) if obj.employee_id else ""


class AppointmentSerializer(CompanyScopedSerializer):
    same_company_fields = ["patient", "staff"]
    patient_name = serializers.CharField(source="patient.__str__", read_only=True)
    staff_name = serializers.CharField(source="staff.name", read_only=True)

    class Meta:
        model = Appointment
        fields = [
            "id",
            "patient",
            "patient_name",
            "staff",
            "staff_name",
            "visit_type",
            "scheduled_at",
            "duration_minutes",
            "room",
            "reason",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "status", "created_at"]


class MedicalRecordSerializer(CompanyScopedSerializer):
    same_company_fields = ["patient", "appointment", "recorded_by"]
    patient_name = serializers.CharField(source="patient.__str__", read_only=True)
    recorded_by_name = serializers.CharField(source="recorded_by.name", read_only=True)

    class Meta:
        model = MedicalRecord
        fields = [
            "id",
            "patient",
            "patient_name",
            "appointment",
            "recorded_by",
            "recorded_by_name",
            "record_date",
            "diagnosis",
            "notes",
            "blood_pressure",
            "temperature_celsius",
            "pulse_bpm",
            "weight_kg",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class DiagnosticOrderSerializer(CompanyScopedSerializer):
    same_company_fields = ["patient", "doctor", "medical_record"]
    patient_name = serializers.CharField(source="patient.__str__", read_only=True)
    doctor_name = serializers.CharField(source="doctor.name", read_only=True)

    class Meta:
        model = DiagnosticOrder
        fields = [
            "id",
            "patient",
            "patient_name",
            "doctor",
            "doctor_name",
            "medical_record",
            "type",
            "test_name",
            "status",
            "ordered_date",
            "result_text",
            "result_date",
            "created_at",
        ]
        read_only_fields = ["id", "status", "result_text", "result_date", "created_at"]


class PrescriptionLineSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    dispensed = serializers.SerializerMethodField()

    class Meta:
        model = PrescriptionLine
        fields = ["id", "item", "item_name", "quantity", "dosage_instructions", "dispensed"]
        read_only_fields = ["id", "dispensed"]

    def get_dispensed(self, obj):
        return obj.movement_id is not None


class PrescriptionSerializer(CompanyScopedSerializer):
    same_company_fields = ["patient", "doctor", "medical_record"]
    patient_name = serializers.CharField(source="patient.__str__", read_only=True)
    doctor_name = serializers.CharField(source="doctor.name", read_only=True)
    lines = PrescriptionLineSerializer(many=True)

    class Meta:
        model = Prescription
        fields = [
            "id",
            "number",
            "patient",
            "patient_name",
            "doctor",
            "doctor_name",
            "medical_record",
            "prescribed_date",
            "status",
            "lines",
            "created_at",
        ]
        read_only_fields = ["id", "number", "status", "created_at"]

    def validate_lines(self, lines):
        if not lines:
            raise serializers.ValidationError("At least one medication line is required.")
        return lines

    def create(self, validated_data):
        lines_data = validated_data.pop("lines")
        company = validated_data["company"]
        with transaction.atomic():
            prescription = Prescription.objects.create(**validated_data)
            prescription.number = next_number(company, "RX")
            prescription.save(update_fields=["number"])
            for line in lines_data:
                if line["item"].company_id != company.id:
                    raise serializers.ValidationError({"lines": "All medications must belong to the active company."})
                PrescriptionLine.objects.create(company=company, prescription=prescription, **line)
        return prescription


class BedSerializer(CompanyScopedSerializer):
    class Meta:
        model = Bed
        fields = ["id", "ward", "bed_number", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]


class AdmissionSerializer(CompanyScopedSerializer):
    same_company_fields = ["patient", "bed", "admitting_doctor"]
    patient_name = serializers.CharField(source="patient.__str__", read_only=True)
    bed_label = serializers.CharField(source="bed.__str__", read_only=True)
    doctor_name = serializers.CharField(source="admitting_doctor.name", read_only=True)

    class Meta:
        model = Admission
        fields = [
            "id",
            "number",
            "patient",
            "patient_name",
            "bed",
            "bed_label",
            "admitting_doctor",
            "doctor_name",
            "reason",
            "discharged_at",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "number", "discharged_at", "status", "created_at"]

    def validate_bed(self, bed):
        if bed.status != Bed.Status.AVAILABLE:
            raise serializers.ValidationError("This bed isn't available.")
        return bed

    def create(self, validated_data):
        company = validated_data["company"]
        with transaction.atomic():
            admission = Admission.objects.create(**validated_data)
            admission.number = next_number(company, "ADM")
            admission.save(update_fields=["number"])
            bed = admission.bed
            bed.status = Bed.Status.OCCUPIED
            bed.save(update_fields=["status"])
        return admission


class InsuranceProviderSerializer(CompanyScopedSerializer):
    class Meta:
        model = InsuranceProvider
        fields = ["id", "name", "contact_phone", "contact_email", "is_active", "created_at"]
        read_only_fields = ["id", "created_at"]


class PatientInsuranceSerializer(CompanyScopedSerializer):
    same_company_fields = ["patient", "provider"]
    patient_name = serializers.CharField(source="patient.__str__", read_only=True)
    provider_name = serializers.CharField(source="provider.name", read_only=True)

    class Meta:
        model = PatientInsurance
        fields = [
            "id",
            "patient",
            "patient_name",
            "provider",
            "provider_name",
            "policy_number",
            "coverage_percent",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class MedicalBillLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalBillLine
        fields = ["id", "description", "amount_cents"]
        read_only_fields = ["id"]


class MedicalBillSerializer(CompanyScopedSerializer):
    same_company_fields = ["patient", "admission", "appointment", "patient_insurance"]
    patient_name = serializers.CharField(source="patient.__str__", read_only=True)
    lines = MedicalBillLineSerializer(many=True)

    class Meta:
        model = MedicalBill
        fields = [
            "id",
            "number",
            "patient",
            "patient_name",
            "admission",
            "appointment",
            "patient_insurance",
            "subtotal_cents",
            "insurance_covered_cents",
            "patient_owed_cents",
            "paid_amount_cents",
            "status",
            "lines",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "number",
            "subtotal_cents",
            "insurance_covered_cents",
            "patient_owed_cents",
            "paid_amount_cents",
            "status",
            "created_at",
        ]

    def validate_lines(self, lines):
        if not lines:
            raise serializers.ValidationError("At least one charge line is required.")
        return lines

    def create(self, validated_data):
        lines_data = validated_data.pop("lines")
        company = validated_data["company"]
        with transaction.atomic():
            bill = MedicalBill.objects.create(**validated_data)
            bill.number = next_number(company, "MBILL")
            MedicalBillLine.objects.bulk_create(
                [MedicalBillLine(company=company, bill=bill, **line) for line in lines_data]
            )
            subtotal = sum(line["amount_cents"] for line in lines_data)
            coverage = bill.patient_insurance.coverage_percent if bill.patient_insurance else 0
            insurance_covered = int(subtotal * coverage / 100)
            bill.subtotal_cents = subtotal
            bill.insurance_covered_cents = insurance_covered
            bill.patient_owed_cents = subtotal - insurance_covered
            bill.save(
                update_fields=["number", "subtotal_cents", "insurance_covered_cents", "patient_owed_cents"]
            )
        return bill


class BloodUnitSerializer(CompanyScopedSerializer):
    same_company_fields = ["reserved_for"]
    reserved_for_name = serializers.SerializerMethodField()

    class Meta:
        model = BloodUnit
        fields = [
            "id",
            "blood_type",
            "volume_ml",
            "collected_date",
            "expiry_date",
            "status",
            "reserved_for",
            "reserved_for_name",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "status", "reserved_for", "created_at"]

    def get_reserved_for_name(self, obj):
        return str(obj.reserved_for) if obj.reserved_for_id else ""
