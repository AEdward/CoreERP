"""The one place other apps reach into to raise a notification — mirrors
apps.accounting.posting and apps.roles.seed's "one shared helper, called
from wherever the real event happens" shape, so a new trigger elsewhere
in the codebase is a two-line addition, not a new notifications concept.
"""

from .models import Notification


def notify_users(company, users, message, link=""):
    Notification.objects.bulk_create(
        [Notification(company=company, recipient=u, message=message, link=link) for u in users]
    )


def notify_permission(company, module, action, message, link=""):
    """Notify every active member of `company` who holds `<module>.<action>` —
    e.g. notify_permission(company, "accounting", "manage", "...") reaches
    every Finance Manager (and the Owner) without the caller needing to
    know which roles happen to carry that permission today."""
    from apps.companies.models import CompanyMembership
    from apps.roles.models import MembershipRole
    from apps.users.models import User

    user_ids = (
        MembershipRole.objects.filter(
            membership__company_id=company.id,
            membership__status=CompanyMembership.Status.ACTIVE,
            role__rolepermission__permission__module=module,
            role__rolepermission__permission__action=action,
        )
        .values_list("membership__user_id", flat=True)
        .distinct()
    )
    notify_users(company, User.objects.filter(id__in=user_ids), message, link)
