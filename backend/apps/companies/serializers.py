from rest_framework import serializers

from .models import Company, CompanyMembership


class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "logo_url",
            "industry",
            "country",
            "currency",
            "timezone",
            "tax_number",
            "address",
            "phone",
            "email",
            "status",
            "created_at",
        ]
        read_only_fields = ["id", "status", "created_at"]


class RoleNameSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()


class CompanyMembershipSerializer(serializers.ModelSerializer):
    company = CompanySerializer(read_only=True)
    roles = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = CompanyMembership
        fields = ["id", "company", "status", "roles", "permissions", "created_at", "accepted_at"]

    def get_roles(self, membership):
        return [
            {"id": mr.role_id, "name": mr.role.name}
            for mr in membership.membership_roles.all()
        ]

    def get_permissions(self, membership):
        """Flattened "module.action" strings — what the frontend gates
        dashboard tiles on, so it never has to know role names itself."""
        keys = set()
        for mr in membership.membership_roles.all():
            for permission in mr.role.permissions.all():
                keys.add(f"{permission.module}.{permission.action}")
        return sorted(keys)
