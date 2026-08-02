from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.utils import timezone

from apps.companies.models import Company, CompanyMembership
from apps.roles.models import MembershipRole
from apps.roles.seed import create_default_roles_for_company
from apps.users.models import User

DEMO_PASSWORD = "demopass123"

DEMO_USERS = [
    ("owner@demo.test", "Demo", "Owner", "Owner"),
    ("finance@demo.test", "Demo", "Finance", "Finance Manager"),
    ("hr@demo.test", "Demo", "HR", "HR Manager"),
    ("sales@demo.test", "Demo", "Sales", "Sales Manager"),
    ("inventory@demo.test", "Demo", "Inventory", "Inventory Manager"),
]


class Command(BaseCommand):
    help = "Seed a demo company with one user per default role, for local dev."

    @transaction.atomic
    def handle(self, *args, **options):
        # Management commands run outside CurrentCompanyMiddleware, so the
        # RLS session GUCs (see apps/companies/migrations/0003) are unset
        # by default — writes would be blocked by the tenant-isolation
        # policies. Seeding is inherently a platform-level operation, not
        # tied to one end user, so it runs with the platform-admin bypass.
        with connection.cursor() as cursor:
            cursor.execute("SET app.is_platform_admin = 'true'")

        company, created = Company.objects.get_or_create(
            name="Demo Co",
            defaults={
                "industry": "Retail",
                "country": "Ethiopia",
                "currency": "ETB",
                "timezone": "Africa/Addis_Ababa",
                "status": Company.Status.ACTIVE,
            },
        )
        roles = create_default_roles_for_company(company)

        for email, first_name, last_name, role_name in DEMO_USERS:
            user, user_created = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": first_name,
                    "last_name": last_name,
                    "status": User.Status.ACTIVE,
                },
            )
            if user_created:
                user.set_password(DEMO_PASSWORD)
                user.save(update_fields=["password"])

            membership, _ = CompanyMembership.objects.get_or_create(
                user=user,
                company=company,
                defaults={"status": CompanyMembership.Status.ACTIVE, "accepted_at": timezone.now()},
            )
            MembershipRole.objects.get_or_create(membership=membership, role=roles[role_name])

        self.stdout.write(self.style.SUCCESS(f"Seeded '{company.name}' ({'created' if created else 'already existed'})"))
        self.stdout.write(f"Demo accounts (password: {DEMO_PASSWORD}):")
        for email, _, _, role_name in DEMO_USERS:
            self.stdout.write(f"  {email:<24} {role_name}")
