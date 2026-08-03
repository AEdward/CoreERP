from django.urls import path

from .views import CompanySummaryView

urlpatterns = [
    path("summary/", CompanySummaryView.as_view(), name="company-summary"),
]
