from django.contrib import admin

from .models import MembershipRole, Permission, Role, RolePermission


class RolePermissionInline(admin.TabularInline):
    model = RolePermission
    extra = 1


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ["name", "company", "is_system_role"]
    list_filter = ["is_system_role", "company"]
    search_fields = ["name"]
    inlines = [RolePermissionInline]


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ["module", "action"]
    list_filter = ["module"]


@admin.register(MembershipRole)
class MembershipRoleAdmin(admin.ModelAdmin):
    list_display = ["membership", "role"]
