from rest_framework.routers import DefaultRouter

from .views import (
    AdmissionViewSet,
    AppointmentViewSet,
    BedViewSet,
    BloodUnitViewSet,
    DiagnosticOrderViewSet,
    InsuranceProviderViewSet,
    MedicalBillViewSet,
    MedicalRecordViewSet,
    MedicalStaffViewSet,
    PatientInsuranceViewSet,
    PatientViewSet,
    PrescriptionViewSet,
)

router = DefaultRouter()
router.register("patients", PatientViewSet, basename="healthcare-patient")
router.register("staff", MedicalStaffViewSet, basename="healthcare-staff")
router.register("appointments", AppointmentViewSet, basename="healthcare-appointment")
router.register("medical-records", MedicalRecordViewSet, basename="healthcare-medical-record")
router.register("diagnostic-orders", DiagnosticOrderViewSet, basename="healthcare-diagnostic-order")
router.register("prescriptions", PrescriptionViewSet, basename="healthcare-prescription")
router.register("beds", BedViewSet, basename="healthcare-bed")
router.register("admissions", AdmissionViewSet, basename="healthcare-admission")
router.register("insurance-providers", InsuranceProviderViewSet, basename="healthcare-insurance-provider")
router.register("patient-insurances", PatientInsuranceViewSet, basename="healthcare-patient-insurance")
router.register("bills", MedicalBillViewSet, basename="healthcare-bill")
router.register("blood-units", BloodUnitViewSet, basename="healthcare-blood-unit")

urlpatterns = router.urls
