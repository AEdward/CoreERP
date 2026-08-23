from rest_framework import serializers

from apps.common.serializers import CompanyScopedSerializer
from apps.companies.models import CompanyMembership

from .models import Contact, Customer, Lead, Opportunity


class CustomerSerializer(CompanyScopedSerializer):
    class Meta:
        model = Customer
        fields = ["id", "name", "phone", "email", "type", "address", "created_at"]
        read_only_fields = ["id", "created_at"]


class ContactSerializer(CompanyScopedSerializer):
    same_company_fields = ["customer"]

    class Meta:
        model = Contact
        fields = ["id", "customer", "name", "title", "email", "phone", "is_primary", "created_at"]
        read_only_fields = ["id", "created_at"]


def _validate_active_member(assigned_to, request):
    company = getattr(request, "company", None)
    if assigned_to is not None and company is not None:
        is_member = CompanyMembership.objects.filter(
            user=assigned_to, company=company, status=CompanyMembership.Status.ACTIVE
        ).exists()
        if not is_member:
            raise serializers.ValidationError("Must be an active member of the active company.")
    return assigned_to


class LeadSerializer(CompanyScopedSerializer):
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = [
            "id",
            "name",
            "company_name",
            "email",
            "phone",
            "source",
            "status",
            "notes",
            "assigned_to",
            "assigned_to_name",
            "converted_customer",
            "created_at",
        ]
        read_only_fields = ["id", "status", "converted_customer", "created_at"]

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.full_name if obj.assigned_to_id else ""

    def validate_assigned_to(self, assigned_to):
        # assigned_to is a User, not a TenantModel, so same_company_fields
        # (which checks .company_id) can't cover it — same pattern as
        # apps.tasks.TaskSerializer.validate_assignee.
        return _validate_active_member(assigned_to, self.context.get("request"))


class OpportunitySerializer(CompanyScopedSerializer):
    same_company_fields = ["customer", "lead"]
    assigned_to_name = serializers.SerializerMethodField()

    class Meta:
        model = Opportunity
        fields = [
            "id",
            "customer",
            "lead",
            "name",
            "stage",
            "amount_cents",
            "expected_close_date",
            "notes",
            "assigned_to",
            "assigned_to_name",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.full_name if obj.assigned_to_id else ""

    def validate_assigned_to(self, assigned_to):
        return _validate_active_member(assigned_to, self.context.get("request"))
