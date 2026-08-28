from rest_framework import serializers

from apps.common.serializers import CompanyScopedSerializer

from .models import PerformanceReview, TrainingEnrollment, TrainingProgram


class PerformanceReviewSerializer(CompanyScopedSerializer):
    same_company_fields = ["employee", "reviewer"]

    class Meta:
        model = PerformanceReview
        fields = [
            "id",
            "employee",
            "reviewer",
            "review_period",
            "rating",
            "comments",
            "status",
            "completed_at",
            "created_at",
        ]
        read_only_fields = ["id", "status", "completed_at", "created_at"]


class TrainingProgramSerializer(CompanyScopedSerializer):
    enrollment_count = serializers.IntegerField(source="enrollments.count", read_only=True)

    class Meta:
        model = TrainingProgram
        fields = [
            "id",
            "title",
            "description",
            "provider",
            "start_date",
            "end_date",
            "enrollment_count",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class TrainingEnrollmentSerializer(CompanyScopedSerializer):
    same_company_fields = ["program", "employee"]
    program_title = serializers.CharField(source="program.title", read_only=True)

    class Meta:
        model = TrainingEnrollment
        fields = [
            "id",
            "program",
            "program_title",
            "employee",
            "status",
            "completion_date",
            "created_at",
        ]
        read_only_fields = ["id", "status", "completion_date", "created_at"]
