from django.db import connection, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import user_has_permission
from apps.roles.models import MembershipRole
from apps.roles.seed import create_default_roles_for_company

from .models import Company, CompanyMembership
from .serializers import CompanySerializer


class CompanyListCreateView(APIView):
    def get(self, request):
        companies = Company.objects.filter(
            memberships__user=request.user, memberships__status=CompanyMembership.Status.ACTIVE
        ).distinct()
        return Response(CompanySerializer(companies, many=True).data)

    def post(self, request):
        serializer = CompanySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            # A brand-new company has no CompanyMembership yet — and the
            # companies RLS policy's USING clause (which INSERT...RETURNING
            # is also subject to, not just WITH CHECK) grants visibility
            # only through an existing membership. Bootstrapping a company
            # is the one legitimate case where that's backwards: the
            # membership *is* what we're about to create. SET LOCAL scopes
            # the bypass to just this transaction — it can't leak to any
            # other request on a reused connection.
            with connection.cursor() as cursor:
                cursor.execute("SET LOCAL app.is_platform_admin = 'true'")

            company = serializer.save(status=Company.Status.TRIAL)
            membership = CompanyMembership.objects.create(
                user=request.user,
                company=company,
                status=CompanyMembership.Status.ACTIVE,
                accepted_at=timezone.now(),
            )
            roles = create_default_roles_for_company(company)
            MembershipRole.objects.create(membership=membership, role=roles["Owner"])

        return Response(CompanySerializer(company).data, status=status.HTTP_201_CREATED)


class CompanyDetailView(APIView):
    def get_company(self, request, pk):
        company = get_object_or_404(Company, pk=pk)
        is_member = CompanyMembership.objects.filter(
            user=request.user, company=company, status=CompanyMembership.Status.ACTIVE
        ).exists()
        if not (is_member or request.user.is_platform_admin):
            company = None
        return company

    def get(self, request, pk):
        company = self.get_company(request, pk)
        if company is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(CompanySerializer(company).data)

    def patch(self, request, pk):
        company = self.get_company(request, pk)
        if company is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not user_has_permission(request.user, company, "settings", "manage"):
            return Response(
                {"detail": "You don't have permission to edit this company's settings."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = CompanySerializer(company, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class SetActiveCompanyView(APIView):
    def post(self, request):
        company_id = request.data.get("company_id")
        membership = CompanyMembership.objects.filter(
            user=request.user, company_id=company_id, status=CompanyMembership.Status.ACTIVE
        ).first()
        if membership is None:
            return Response(
                {"detail": "Not an active member of that company."}, status=status.HTTP_403_FORBIDDEN
            )
        request.session["active_company_id"] = membership.company_id
        return Response(CompanySerializer(membership.company).data)
