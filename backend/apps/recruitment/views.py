from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.auditlog.models import AuditLog
from apps.auditlog.services import log_audit
from apps.common.views import CompanyScopedViewSet
from apps.hr.models import Employee

from .models import Applicant, JobVacancy, OnboardingTask
from .serializers import ApplicantSerializer, JobVacancySerializer, OnboardingTaskSerializer


class JobVacancyViewSet(CompanyScopedViewSet):
    queryset = JobVacancy.objects.prefetch_related("applicants").all()
    serializer_class = JobVacancySerializer
    permission_module = "hr"


class ApplicantViewSet(CompanyScopedViewSet):
    queryset = Applicant.objects.select_related("vacancy", "hired_employee").all()
    serializer_class = ApplicantSerializer
    permission_module = "hr"

    def get_queryset(self):
        qs = super().get_queryset()
        vacancy_id = self.request.query_params.get("vacancy")
        if vacancy_id:
            qs = qs.filter(vacancy_id=vacancy_id)
        return qs

    def perform_destroy(self, instance):
        if instance.status == Applicant.Status.HIRED:
            raise ValidationError("Cannot delete an applicant who was already hired.")
        super().perform_destroy(instance)

    @action(detail=True, methods=["post"])
    def hire(self, request, pk=None):
        """Converts an Applicant into a real hr.Employee — the one
        concrete trigger this project builds for "Onboarding" (see
        OnboardingTask). Only first/last name plus department/position
        carry over automatically; salary and everything else stays a
        deliberate HR follow-up on the new Employee record, the same
        "record what's known, don't guess the rest" scope call
        EmployeeContract's docstring already makes."""
        applicant = self.get_object()
        if applicant.status == Applicant.Status.HIRED:
            raise ValidationError("This applicant has already been hired.")
        if applicant.status == Applicant.Status.REJECTED:
            raise ValidationError("Cannot hire a rejected applicant.")

        name_parts = applicant.full_name.strip().split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        employee = Employee.objects.create(
            company=applicant.company,
            first_name=first_name,
            last_name=last_name,
            email=applicant.email,
            phone=applicant.phone,
            department=applicant.vacancy.department,
            position=applicant.vacancy.position,
            joining_date=timezone.now().date(),
        )
        log_audit(request, employee, AuditLog.Action.CREATED)

        applicant.status = Applicant.Status.HIRED
        applicant.hired_employee = employee
        applicant.save(update_fields=["status", "hired_employee"])
        log_audit(
            request, applicant, AuditLog.Action.UPDATED,
            {"status": [applicant.status, "hired"], "hired_employee": [None, employee.pk]},
        )

        return Response(ApplicantSerializer(applicant).data)


class OnboardingTaskViewSet(CompanyScopedViewSet):
    queryset = OnboardingTask.objects.select_related("employee").all()
    serializer_class = OnboardingTaskSerializer
    permission_module = "hr"

    def get_queryset(self):
        qs = super().get_queryset()
        employee_id = self.request.query_params.get("employee")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        return qs
