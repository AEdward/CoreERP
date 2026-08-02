from rest_framework.permissions import BasePermission

from apps.companies.models import CompanyMembership
from apps.roles.models import MembershipRole


def user_has_permission(user, company, module, action):
    """The single place authorization is decided. Every view/route checks
    through this — never by inferring access from a role's label.
    """
    if not (user and user.is_authenticated) or company is None:
        return False
    if user.is_platform_admin:
        return True

    return MembershipRole.objects.filter(
        membership__user_id=user.id,
        membership__company_id=company.id,
        membership__status=CompanyMembership.Status.ACTIVE,
        role__rolepermission__permission__module=module,
        role__rolepermission__permission__action=action,
    ).exists()


class HasCompanyPermission(BasePermission):
    """DRF permission class: gate a view behind `permission_required`

    Usage:
        class InvoiceView(APIView):
            permission_required = ("accounting", "manage")

    Requires CurrentCompanyMiddleware to have set `request.company`.
    """

    message = "You don't have permission to do that in this company."

    def has_permission(self, request, view):
        module, action = getattr(view, "permission_required", (None, None))
        if module is None:
            return True  # view opted out — falls back to IsAuthenticated etc.
        return user_has_permission(request.user, request.company, module, action)
