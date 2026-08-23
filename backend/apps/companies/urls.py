from django.urls import path

from . import views

urlpatterns = [
    path("", views.CompanyListCreateView.as_view(), name="company-list-create"),
    path("<int:pk>/", views.CompanyDetailView.as_view(), name="company-detail"),
    path("active/", views.SetActiveCompanyView.as_view(), name="company-set-active"),
    path("members/", views.CompanyMembersView.as_view(), name="company-members"),
]
