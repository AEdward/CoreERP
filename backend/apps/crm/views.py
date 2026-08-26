from django.db import transaction
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.auditlog.models import AuditLog
from apps.auditlog.services import log_audit
from apps.common.views import CompanyScopedViewSet

from .models import Contact, Customer, Lead, Opportunity, TravelAgency
from .serializers import (
    ContactSerializer,
    CustomerSerializer,
    LeadSerializer,
    OpportunitySerializer,
    TravelAgencySerializer,
)


class CustomerViewSet(CompanyScopedViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_module = "sales"


class TravelAgencyViewSet(CompanyScopedViewSet):
    queryset = TravelAgency.objects.all()
    serializer_class = TravelAgencySerializer
    permission_module = "sales"


class ContactViewSet(CompanyScopedViewSet):
    queryset = Contact.objects.select_related("customer")
    serializer_class = ContactSerializer
    permission_module = "sales"

    def get_queryset(self):
        qs = super().get_queryset()
        customer_id = self.request.query_params.get("customer")
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        return qs


class LeadViewSet(CompanyScopedViewSet):
    queryset = Lead.objects.select_related("assigned_to", "converted_customer")
    serializer_class = LeadSerializer
    permission_module = "sales"

    @action(detail=True, methods=["post"])
    def convert(self, request, pk=None):
        lead = self.get_object()
        if lead.status == Lead.Status.CONVERTED:
            raise ValidationError("This lead has already been converted.")

        with transaction.atomic():
            customer = Customer.objects.create(
                company=request.company,
                name=lead.company_name or lead.name,
                phone=lead.phone,
                email=lead.email,
                type=Customer.Type.BUSINESS if lead.company_name else Customer.Type.INDIVIDUAL,
            )
            opportunity = Opportunity.objects.create(
                company=request.company,
                customer=customer,
                lead=lead,
                name=lead.company_name or lead.name,
                assigned_to=lead.assigned_to,
            )
            lead.status = Lead.Status.CONVERTED
            lead.converted_customer = customer
            lead.save(update_fields=["status", "converted_customer"])

            # Bypasses perform_create (this is a custom @action, not a
            # plain create), so the two new rows need the same audit-log
            # write CompanyScopedMixin.perform_create would give them —
            # the exact gap PettyCashTransactionViewSet had until it was
            # fixed, not repeating it here.
            log_audit(request, customer, AuditLog.Action.CREATED)
            log_audit(request, opportunity, AuditLog.Action.CREATED)

        return Response(LeadSerializer(lead).data)


class OpportunityViewSet(CompanyScopedViewSet):
    queryset = Opportunity.objects.select_related("customer", "lead", "assigned_to")
    serializer_class = OpportunitySerializer
    permission_module = "sales"

    def get_queryset(self):
        qs = super().get_queryset()
        customer_id = self.request.query_params.get("customer")
        if customer_id:
            qs = qs.filter(customer_id=customer_id)
        return qs
