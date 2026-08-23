"""Thread-local holder for "the user making the current request", set by
CurrentCompanyMiddleware for the lifetime of one request. Exists for
exactly one purpose: letting model signals (which don't get a `request`
argument) attribute an actor on the Activity log — see apps.activity.
Not a general-purpose god-object; if a second use case shows up, that's
fine, this file already exists."""

import threading

_local = threading.local()


def set_current_user(user):
    _local.user = user


def get_current_user():
    return getattr(_local, "user", None)
