from django.contrib import admin

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

admin.site.register(Patient)
admin.site.register(MedicalStaff)
admin.site.register(Appointment)
admin.site.register(MedicalRecord)
admin.site.register(DiagnosticOrder)
admin.site.register(Prescription)
admin.site.register(PrescriptionLine)
admin.site.register(Bed)
admin.site.register(Admission)
admin.site.register(InsuranceProvider)
admin.site.register(PatientInsurance)
admin.site.register(MedicalBill)
admin.site.register(MedicalBillLine)
admin.site.register(BloodUnit)
