"""
Django settings for the CoreERP backend.

See docs/ARCHITECTURE.md in the repo root for the system design this
implements — multi-tenancy model, data model, and phased roadmap.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def env_bool(name, default=False):
    return os.environ.get(name, str(default)).lower() in ("1", "true", "yes")


def env_list(name, default=""):
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "django-insecure-dev-only-change-me")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "apps.common",
    "apps.auditlog",
    "apps.approvals",
    "apps.users",
    "apps.companies",
    "apps.roles",
    "apps.branches",
    "apps.hr",
    "apps.crm",
    "apps.hotel",
    "apps.housekeeping",
    "apps.costcenters",
    "apps.suppliers",
    "apps.tax",
    "apps.catalog",
    "apps.inventory",
    "apps.maintenance",
    "apps.conference",
    "apps.gym",
    "apps.laundry",
    "apps.spa",
    "apps.loyalty",
    "apps.pos",
    "apps.procurement",
    "apps.sales",
    "apps.expenses",
    "apps.accounting",
    "apps.payroll",
    "apps.recruitment",
    "apps.performance",
    "apps.fleet",
    "apps.manufacturing",
    "apps.realestate",
    "apps.selfservice",
    "apps.activity",
    "apps.documents",
    "apps.notes",
    "apps.notifications",
    "apps.tasks",
    "apps.calendar",
    "apps.search",
    "apps.dashboard",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.common.middleware.CurrentCompanyMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

_db_options = {}
if os.environ.get("DB_SSLMODE"):
    # Only set for hosted Postgres (e.g. Supabase, which requires TLS) —
    # left unset for local Docker Postgres so nothing changes there.
    _db_options["sslmode"] = os.environ["DB_SSLMODE"]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.environ.get("DB_NAME", "coreerp"),
        "USER": os.environ.get("DB_USER", "coreerp_app"),
        "PASSWORD": os.environ.get("DB_PASSWORD", "coreerp_app"),
        "HOST": os.environ.get("DB_HOST", "localhost"),
        "PORT": os.environ.get("DB_PORT", "5432"),
        "OPTIONS": _db_options,
    }
}

AUTH_USER_MODEL = "users.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Local disk storage — fine for the dev/demo footprint this project runs
# at today. A real deployment would point this at S3-compatible object
# storage instead; noted as a known limitation rather than built now.
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
DATA_UPLOAD_MAX_MEMORY_SIZE = 20 * 1024 * 1024  # 20MB — generous for the attachments apps.documents expects

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
)
CORS_ALLOW_CREDENTIALS = True

# The Next.js frontend runs on a different port (different origin, even
# though it's the same site) — Django's CSRF middleware checks the
# request's Origin header against this list for any cross-origin POST.
CSRF_TRUSTED_ORIGINS = env_list(
    "CSRF_TRUSTED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
)
