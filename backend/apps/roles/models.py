from django.db import models

from apps.companies.models import Company, CompanyMembership


class Permission(models.Model):
    """A (module, action) pair — structured, not a free-text string.

    e.g. ("accounting", "approve"), ("inventory", "view").
    """

    module = models.CharField(max_length=64)
    action = models.CharField(max_length=32)

    class Meta:
        db_table = "permissions"
        constraints = [
            models.UniqueConstraint(fields=["module", "action"], name="unique_module_action")
        ]
        ordering = ["module", "action"]

    def __str__(self):
        return f"{self.module}.{self.action}"


class Role(models.Model):
    """A named bundle of Permissions.

    company = null means a platform-level role (e.g. Super Admin is
    represented by User.is_platform_admin directly, not a Role — but the
    field stays nullable so future platform-level roles have somewhere to
    live without a schema change). Every company-level role sets company.
    """

    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="roles", null=True, blank=True
    )
    name = models.CharField(max_length=100)
    is_system_role = models.BooleanField(
        default=False, help_text="Seeded default role vs. a company-defined custom role."
    )
    permissions = models.ManyToManyField(Permission, through="RolePermission", related_name="roles")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "roles"
        constraints = [
            models.UniqueConstraint(fields=["company", "name"], name="unique_company_role_name")
        ]
        ordering = ["company_id", "name"]

    def __str__(self):
        scope = self.company.name if self.company_id else "platform"
        return f"{self.name} ({scope})"


class RolePermission(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)

    class Meta:
        db_table = "role_permissions"
        constraints = [
            models.UniqueConstraint(fields=["role", "permission"], name="unique_role_permission")
        ]

    def __str__(self):
        return f"{self.role} -> {self.permission}"


class MembershipRole(models.Model):
    """Which Role(s) a CompanyMembership holds within that company."""

    membership = models.ForeignKey(
        CompanyMembership, on_delete=models.CASCADE, related_name="membership_roles"
    )
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="membership_roles")

    class Meta:
        db_table = "membership_roles"
        constraints = [
            models.UniqueConstraint(fields=["membership", "role"], name="unique_membership_role")
        ]

    def __str__(self):
        return f"{self.membership} -> {self.role}"
