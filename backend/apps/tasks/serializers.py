from rest_framework import serializers

from apps.common.serializers import CompanyScopedSerializer
from apps.companies.models import CompanyMembership

from .models import Task


class TaskSerializer(CompanyScopedSerializer):
    assignee_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Task
        fields = [
            "id",
            "title",
            "description",
            "assignee",
            "assignee_name",
            "due_date",
            "status",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_assignee_name(self, obj):
        return obj.assignee.full_name if obj.assignee_id else ""

    def get_created_by_name(self, obj):
        return obj.created_by.full_name if obj.created_by_id else ""

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)

    def validate_assignee(self, assignee):
        # assignee is a User, not a TenantModel, so CompanyScopedSerializer's
        # same_company_fields (which checks .company_id) can't cover it —
        # "member of the active company" is the equivalent check here.
        request = self.context.get("request")
        company = getattr(request, "company", None)
        if assignee is not None and company is not None:
            is_member = CompanyMembership.objects.filter(
                user=assignee, company=company, status=CompanyMembership.Status.ACTIVE
            ).exists()
            if not is_member:
                raise serializers.ValidationError("Must be an active member of the active company.")
        return assignee
