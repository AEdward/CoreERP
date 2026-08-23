from django.apps import AppConfig


class ActivityConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.activity"
    label = "activity"

    def ready(self):
        from django.apps import apps as django_apps
        from django.db.models.signals import post_save

        from apps.common.targeting import ALLOWED_TARGETS

        from .signals import log_target_created

        # Every model that can take a Document/Note is also worth an
        # automatic "created" entry on its own activity timeline — reusing
        # the same whitelist means a new target only has to be added once.
        for key in ALLOWED_TARGETS:
            app_label, model_name = key.split(".")
            try:
                model = django_apps.get_model(app_label, model_name)
            except LookupError:
                continue
            post_save.connect(log_target_created, sender=model, weak=False, dispatch_uid=f"activity_created_{key}")
