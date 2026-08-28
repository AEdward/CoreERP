from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.common.views import CompanyScopedViewSet

from .models import PerformanceReview, ReviewCycle, TrainingEnrollment, TrainingProgram
from .serializers import (
    PerformanceReviewSerializer,
    ReviewCycleSerializer,
    TrainingEnrollmentSerializer,
    TrainingProgramSerializer,
)


class ReviewCycleViewSet(CompanyScopedViewSet):
    queryset = ReviewCycle.objects.select_related("employee").prefetch_related("reviews").all()
    serializer_class = ReviewCycleSerializer
    permission_module = "hr"

    def get_queryset(self):
        qs = super().get_queryset()
        employee_id = self.request.query_params.get("employee")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        return qs

    def perform_destroy(self, instance):
        if instance.reviews.exists():
            raise ValidationError("Remove or reassign this cycle's reviews before deleting it.")
        super().perform_destroy(instance)

    @action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        cycle = self.get_object()
        if cycle.status != ReviewCycle.Status.OPEN:
            raise ValidationError("Only an open review cycle can be closed.")
        cycle.status = ReviewCycle.Status.CLOSED
        cycle.closed_at = timezone.now()
        cycle.save(update_fields=["status", "closed_at"])
        return Response(ReviewCycleSerializer(cycle).data)


class PerformanceReviewViewSet(CompanyScopedViewSet):
    queryset = PerformanceReview.objects.select_related("employee", "reviewer", "cycle").all()
    serializer_class = PerformanceReviewSerializer
    permission_module = "hr"

    def get_queryset(self):
        qs = super().get_queryset()
        employee_id = self.request.query_params.get("employee")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        cycle_id = self.request.query_params.get("cycle")
        if cycle_id:
            qs = qs.filter(cycle_id=cycle_id)
        return qs

    def perform_update(self, serializer):
        if serializer.instance.status != PerformanceReview.Status.DRAFT:
            raise ValidationError("Only a draft review can be edited.")
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        if instance.status != PerformanceReview.Status.DRAFT:
            raise ValidationError("Only a draft review can be deleted.")
        super().perform_destroy(instance)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        review = self.get_object()
        if review.status != PerformanceReview.Status.DRAFT:
            raise ValidationError("Only a draft review can be completed.")
        if not review.rating:
            raise ValidationError("A rating is required before completing a review.")
        review.status = PerformanceReview.Status.COMPLETED
        review.completed_at = timezone.now()
        review.save(update_fields=["status", "completed_at"])
        return Response(PerformanceReviewSerializer(review).data)


class TrainingProgramViewSet(CompanyScopedViewSet):
    queryset = TrainingProgram.objects.prefetch_related("enrollments").all()
    serializer_class = TrainingProgramSerializer
    permission_module = "hr"


class TrainingEnrollmentViewSet(CompanyScopedViewSet):
    queryset = TrainingEnrollment.objects.select_related("program", "employee").all()
    serializer_class = TrainingEnrollmentSerializer
    permission_module = "hr"

    def get_queryset(self):
        qs = super().get_queryset()
        program_id = self.request.query_params.get("program")
        if program_id:
            qs = qs.filter(program_id=program_id)
        employee_id = self.request.query_params.get("employee")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)
        return qs

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        enrollment = self.get_object()
        if enrollment.status != TrainingEnrollment.Status.ENROLLED:
            raise ValidationError("Only an enrolled record can be marked completed.")
        enrollment.status = TrainingEnrollment.Status.COMPLETED
        enrollment.completion_date = timezone.now().date()
        enrollment.save(update_fields=["status", "completion_date"])
        return Response(TrainingEnrollmentSerializer(enrollment).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        enrollment = self.get_object()
        if enrollment.status != TrainingEnrollment.Status.ENROLLED:
            raise ValidationError("Only an enrolled record can be cancelled.")
        enrollment.status = TrainingEnrollment.Status.CANCELLED
        enrollment.save(update_fields=["status"])
        return Response(TrainingEnrollmentSerializer(enrollment).data)
