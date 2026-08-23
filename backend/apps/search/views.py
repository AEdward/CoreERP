"""One global-search endpoint rather than each module owning its own
search box. Walks apps.common.search_targets.SEARCH_TARGETS, skips any
model the user lacks `view` permission for (via the same
permission_module apps.common.targeting already assigns it), and matches
`q` against each model's own search_fields with a plain icontains OR.
Results are capped per model and in total — this is a quick-jump list,
not a full-text search engine."""

from django.apps import apps as django_apps
from django.db.models import Q
from rest_framework.exceptions import NotFound
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.permissions import user_has_permission
from apps.common.search_targets import SEARCH_TARGETS
from apps.common.targeting import ALLOWED_TARGETS

PER_MODEL_LIMIT = 5
TOTAL_LIMIT = 30


class GlobalSearchView(APIView):
    def get(self, request):
        company = request.company
        if not company:
            raise NotFound("Select an active company first (POST /api/companies/active/).")

        q = (request.query_params.get("q") or "").strip()
        if len(q) < 2:
            return Response([])

        results = []
        for key, config in SEARCH_TARGETS.items():
            if len(results) >= TOTAL_LIMIT:
                break
            entry = ALLOWED_TARGETS.get(key)
            if entry is None:
                continue
            permission_module, module_label = entry
            if not user_has_permission(request.user, company, permission_module, "view"):
                continue

            app_label, model_name = key.split(".")
            model = django_apps.get_model(app_label, model_name)

            text_filter = Q()
            for field in config["search_fields"]:
                text_filter |= Q(**{f"{field}__icontains": q})

            matches = model.objects.filter(company_id=company.id).filter(text_filter)[:PER_MODEL_LIMIT]
            for obj in matches:
                results.append(
                    {
                        "app_label": app_label,
                        "model": model_name,
                        "object_id": obj.pk,
                        "module": module_label,
                        "title": config["title"](obj),
                        "url": config["url"],
                    }
                )

        return Response(results[:TOTAL_LIMIT])
