from rest_framework import serializers

from apps.common.serializers import CompanyScopedSerializer

from .models import Applicant, JobVacancy, OnboardingTask


class JobVacancySerializer(CompanyScopedSerializer):
    same_company_fields = ["department", "position"]
    applicant_count = serializers.IntegerField(source="applicants.count", read_only=True)

    class Meta:
        model = JobVacancy
        fields = [
            "id",
            "title",
            "department",
            "position",
            "description",
            "openings",
            "status",
            "posted_date",
            "applicant_count",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class ApplicantSerializer(CompanyScopedSerializer):
    same_company_fields = ["vacancy", "referred_by"]
    vacancy_title = serializers.CharField(source="vacancy.title", read_only=True)
    referred_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Applicant
        fields = [
            "id",
            "vacancy",
            "vacancy_title",
            "full_name",
            "email",
            "phone",
            "status",
            "applied_date",
            "notes",
            "hired_employee",
            "referred_by",
            "referred_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "hired_employee", "created_at"]

    def get_referred_by_name(self, obj):
        return str(obj.referred_by) if obj.referred_by_id else ""

    def validate_status(self, value):
        if self.instance and self.instance.status == Applicant.Status.HIRED and value != Applicant.Status.HIRED:
            raise serializers.ValidationError("A hired applicant's status can't be changed directly.")
        if value == Applicant.Status.HIRED:
            raise serializers.ValidationError("Use the hire action to hire an applicant.")
        return value


class OnboardingTaskSerializer(CompanyScopedSerializer):
    same_company_fields = ["employee"]

    class Meta:
        model = OnboardingTask
        fields = ["id", "employee", "title", "is_complete", "due_date", "created_at"]
        read_only_fields = ["id", "created_at"]
