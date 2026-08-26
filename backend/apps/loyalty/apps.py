from django.apps import AppConfig


class LoyaltyConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.loyalty"
    label = "loyalty"

    def ready(self):
        from . import signals  # noqa: F401
