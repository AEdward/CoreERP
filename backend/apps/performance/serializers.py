from rest_framework import serializers

from apps.common.serializers import CompanyScopedSerializer

from .models import PerformanceReview, ReviewCycle, TrainingEnrollment, TrainingProgram


class ReviewCycleSerializer(CompanyScopedSerializer):
    same_company_fields = ["employee"]
    employee_name = serializers.CharField(source="employee.__str__", read_only=True)
    average_rating = serializers.FloatField(read_only=True)
    review_count = serializers.IntegerField(source="reviews.count", read_only=True)

    class Meta:
        model = ReviewCycle
        fields = [
            "id",
            "employee",
            "employee_name",
            "review_period",
            "status",
            "closed_at",
            "average_rating",
            "review_count",
            "created_at",
        ]
        read_only_fields = ["id", "status", "closed_at", "created_at"]


class PerformanceReviewSerializer(CompanyScopedSerializer):
    same_company_fields = ["employee", "reviewer", "cycle"]
    reviewer_name = serializers.SerializerMethodField()

    class Meta:
        model = PerformanceReview
        fields = [
            "id",
            "employee",
            "reviewer",
            "reviewer_name",
            "cycle",
            "rater_type",
            "review_period",
            "rating",
            "comments",
            "status",
            "completed_at",
            "created_at",
        ]
        read_only_fields = ["id", "status", "completed_at", "created_at"]

    def get_reviewer_name(self, obj):
        return str(obj.reviewer) if obj.reviewer_id else ""

    def validate(self, attrs):
        cycle = attrs.get("cycle", getattr(self.instance, "cycle", None))
        employee = attrs.get("employee", getattr(self.instance, "employee", None))
        if cycle and employee and cycle.employee_id != employee.id:
            raise serializers.ValidationError(
                {"cycle": "This review cycle belongs to a different employee."}
            )
        return attrs


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
