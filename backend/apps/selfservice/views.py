from django.contrib.contenttypes.models import ContentType
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.approvals.models import ApprovalRequest
from apps.approvals.registry import get_hooks
from apps.hr.models import AttendanceRecord, Employee, LeaveRequest, LeaveType
from apps.hr.serializers import EmployeeSerializer, LeaveTypeSerializer
from apps.notifications.services import notify_permission
from apps.payroll.models import Payslip
from apps.payroll.serializers import PayslipSerializer
from apps.performance.models import PerformanceReview
from apps.performance.serializers import PerformanceReviewSerializer
from apps.recruitment.models import OnboardingTask

from .serializers import MyLeaveRequestSerializer, MyOnboardingTaskSerializer


def _my_employee(request):
    """Every self-service endpoint resolves to exactly one row: the
    Employee in the active company whose `user` is the requester. No
    match means either this user was never linked by HR (see
    EmployeeSerializer.user) or they're looking at the wrong company —
    both are the same "nothing to show" case from the caller's side."""
    if not request.company:
        raise NotFound("Select an active company first (POST /api/companies/active/).")
    try:
        return Employee.objects.get(company=request.company, user=request.user)
    except Employee.DoesNotExist:
        raise NotFound("No employee record is linked to your account in this company.")


class MyProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(EmployeeSerializer(_my_employee(request)).data)


class MyLeaveTypesView(APIView):
    """LeaveTypeViewSet requires hr.view, which a self-service-only
    employee doesn't have — this just exposes the picklist an employee
    needs to submit their own leave request, nothing else about
    LeaveType."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        _my_employee(request)  # 404s if this user has no linked Employee, same guard as every other endpoint here
        return Response(LeaveTypeSerializer(LeaveType.objects.filter(company=request.company), many=True).data)


class MyLeaveRequestViewSet(viewsets.ModelViewSet):
    """Self-service mirror of apps.hr.views.LeaveRequestViewSet: an
    employee can draft and submit their own leave requests without
    needing hr.manage, which the generic viewset (and the generic
    apps.approvals submit endpoint) both require. `submit` duplicates
    ApprovalRequestViewSet.perform_create's core rather than calling it,
    since that view's permission check is exactly the one this endpoint
    exists to carve an exception around."""

    serializer_class = MyLeaveRequestSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        employee = _my_employee(self.request)
        return LeaveRequest.objects.filter(employee=employee).select_related("leave_type")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["employee"] = _my_employee(self.request)
        return context

    def perform_create(self, serializer):
        employee = _my_employee(self.request)
        serializer.save(company=self.request.company, employee=employee)

    def perform_destroy(self, instance):
        if instance.status != LeaveRequest.Status.DRAFT:
            raise ValidationError("Only a draft leave request can be deleted.")
        instance.delete()

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        instance = self.get_object()
        if instance.status != LeaveRequest.Status.DRAFT:
            raise ValidationError("Only a draft leave request can be submitted.")

        content_type = ContentType.objects.get_for_model(LeaveRequest)
        if ApprovalRequest.objects.filter(
            company=request.company, content_type=content_type, object_id=instance.pk,
            status=ApprovalRequest.Status.PENDING,
        ).exists():
            raise ValidationError("This leave request is already awaiting a decision.")

        approval = ApprovalRequest.objects.create(
            company=request.company,
            content_type=content_type,
            object_id=instance.pk,
            target_label=f"Leave Request: {instance}",
            requested_by=request.user,
        )
        hooks = get_hooks("hr", "leaverequest")
        if hooks and hooks["on_requested"]:
            hooks["on_requested"](instance)
        notify_permission(
            request.company, "hr", "manage",
            f"{request.user.full_name} requested leave approval for {instance}",
            link="/dashboard/hr",
        )
        instance.refresh_from_db()
        return Response(MyLeaveRequestSerializer(instance).data)


class MyOnboardingTaskViewSet(viewsets.ModelViewSet):
    serializer_class = MyOnboardingTaskSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        employee = _my_employee(self.request)
        return OnboardingTask.objects.filter(employee=employee)


class MyPayslipViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PayslipSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        employee = _my_employee(self.request)
        return Payslip.objects.filter(employee=employee).select_related("payroll_run").prefetch_related("lines")


class MyAttendanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.hr.serializers import AttendanceRecordSerializer

        employee = _my_employee(request)
        records = AttendanceRecord.objects.filter(employee=employee).order_by("-date")[:60]
        return Response(AttendanceRecordSerializer(records, many=True).data)


class MyPerformanceReviewViewSet(viewsets.ReadOnlyModelViewSet):
    """Only Completed reviews — a Draft one is the reviewer's
    work-in-progress, not yet meant for the employee to see, the same
    "not final until frozen" reasoning apps.performance.PerformanceReview
    itself documents."""

    serializer_class = PerformanceReviewSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        employee = _my_employee(self.request)
        return PerformanceReview.objects.filter(
            employee=employee, status=PerformanceReview.Status.COMPLETED
        ).select_related("reviewer")
