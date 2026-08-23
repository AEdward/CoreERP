from django.db import connection

from apps.common.current_user import set_current_user


class CurrentCompanyMiddleware:
    """Resolves per-request tenant context and does two distinct jobs:

    1. App-layer scoping: attaches `request.company` — the user's *active*
       company (from the session) — for views/querysets to filter business
       data by. This is the narrow, UX-facing scope ("what am I looking at
       right now").

    2. DB-layer backstop: sets Postgres session variables
       (`app.current_user_id`, `app.is_platform_admin`) that Row-Level
       Security policies read (see the RLS migrations in apps.companies
       and apps.roles). RLS is deliberately scoped to "companies this user
       is a member of at all", not the single active company — it exists
       to make cross-tenant data leaks structurally impossible even if a
       view forgets to filter by request.company, not to enforce which one
       company is currently selected. See docs/ARCHITECTURE.md §3.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)
        is_authenticated = bool(user and user.is_authenticated)

        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT set_config('app.current_user_id', %s, false), "
                "set_config('app.is_platform_admin', %s, false)",
                [
                    str(user.id) if is_authenticated else "",
                    "true" if is_authenticated and user.is_platform_admin else "false",
                ],
            )

        request.company = None
        if is_authenticated:
            active_company_id = request.session.get("active_company_id")
            if active_company_id:
                from apps.companies.models import CompanyMembership

                membership = (
                    CompanyMembership.objects.filter(
                        user_id=user.id,
                        company_id=active_company_id,
                        status=CompanyMembership.Status.ACTIVE,
                    )
                    .select_related("company")
                    .first()
                )
                if membership:
                    request.company = membership.company

        set_current_user(user if is_authenticated else None)
        try:
            return self.get_response(request)
        finally:
            set_current_user(None)
