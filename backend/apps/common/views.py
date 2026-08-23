from django.db import IntegrityError, transaction
from rest_framework import viewsets
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated

from apps.auditlog.models import AuditLog
from apps.auditlog.services import log_audit

from .permissions import user_has_permission

DUPLICATE_ERROR = {
    "detail": "That already exists for this company — check for a duplicate name or reference."
}
IN_USE_ERROR = {
    "detail": "Can't delete this — it's still referenced by other records (orders, stock, journal entries, etc.)."
}


class CompanyScopedMixin:
    """Shared logic for every Phase 2+ module viewset.

    Scopes the queryset to the active company (`request.company`, set by
    CurrentCompanyMiddleware) and gates list/retrieve behind
    `<permission_module>.view`, create/update/destroy behind
    `<permission_module>.manage` — the same view/manage split every
    default role in apps.roles.seed already uses. Row-Level Security
    (apps.common.rls) is the backstop behind this, not a substitute for
    it: this is what enforces "which one company am I looking at right
    now", RLS is what makes it structurally impossible to see a company
    you're not even a member of.

    Subclasses just set `queryset`, `serializer_class`, and
    `permission_module` — see apps/hr/views.py for the shape. Mixed into
    both CompanyScopedViewSet (full CRUD) and CompanyScopedReadOnlyViewSet
    (list/retrieve only — for tables like Stock that are only ever
    mutated through a dedicated audit-trailed action, e.g. StockMovement).
    """

    permission_classes = [IsAuthenticated]
    permission_module: str | None = None

    def get_queryset(self):
        if not getattr(self.request, "company", None):
            return self.queryset.none()
        return self.queryset.filter(company_id=self.request.company.id)

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not request.company:
            raise NotFound("Select an active company first (POST /api/companies/active/).")
        action = "view" if self.action in ("list", "retrieve") else "manage"
        if not user_has_permission(request.user, request.company, self.permission_module, action):
            raise PermissionDenied(
                f"You don't have permission to {action} {self.permission_module} in this company."
            )

    def perform_create(self, serializer):
        # A model-level UniqueConstraint on (company, ...) can't be
        # validated by DRF's usual automatic uniqueness check, because
        # `company` is deliberately not a client-writable serializer
        # field (it's injected here, after validation already passed).
        # Without this, a duplicate name crashes as a raw 500 instead of
        # a normal 400 — genuinely reachable via a real duplicate entry,
        # not just a double-click.
        try:
            with transaction.atomic():
                serializer.save(company=self.request.company)
        except IntegrityError as exc:
            raise ValidationError(DUPLICATE_ERROR) from exc
        log_audit(self.request, serializer.instance, AuditLog.Action.CREATED)

    def perform_update(self, serializer):
        # Diffed through the viewset's own serializer, before and after
        # save, rather than raw model fields — so the diff is exactly what
        # the API itself shows (FKs as ids, dates as ISO strings, ...) with
        # no separate field-serialization logic to maintain here.
        before = self.get_serializer(serializer.instance).data
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError as exc:
            raise ValidationError(DUPLICATE_ERROR) from exc
        after = self.get_serializer(serializer.instance).data
        changes = {k: [before.get(k), v] for k, v in after.items() if before.get(k) != v}
        if changes:
            log_audit(self.request, serializer.instance, AuditLog.Action.UPDATED, changes)

    def perform_destroy(self, instance):
        # Most reference/master data (Item, Customer, Supplier, Warehouse,
        # Account...) is FK-PROTECT'd from rows that depend on it, so a
        # delete that's still in use raises ProtectedError (an IntegrityError
        # subclass) rather than silently cascading — this turns that into a
        # normal 400 instead of a raw 500.
        try:
            with transaction.atomic():
                # Logged before delete(), not after: Django resets the
                # instance's pk attribute to None once the row is actually
                # gone, so logging afterward would record object_id=None.
                log_audit(self.request, instance, AuditLog.Action.DELETED)
                instance.delete()
        except IntegrityError as exc:
            raise ValidationError(IN_USE_ERROR) from exc


class CompanyScopedViewSet(CompanyScopedMixin, viewsets.ModelViewSet):
    pass


class CompanyScopedReadOnlyViewSet(CompanyScopedMixin, viewsets.ReadOnlyModelViewSet):
    pass
