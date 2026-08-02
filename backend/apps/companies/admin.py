from django.contrib import admin

from .models import Company, CompanyMembership


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ["name", "industry", "country", "currency", "status", "created_at"]
    search_fields = ["name", "tax_number", "email"]
    list_filter = ["status", "country"]


@admin.register(CompanyMembership)
class CompanyMembershipAdmin(admin.ModelAdmin):
    list_display = ["user", "company", "status", "created_at", "accepted_at"]
    list_filter = ["status", "company"]
    search_fields = ["user__email", "company__name"]
