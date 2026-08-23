from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import DepartmentViewSet, EmployeeViewSet, EmployeePickerView

router = DefaultRouter()
router.register("departments", DepartmentViewSet, basename="department")
router.register("employees", EmployeeViewSet, basename="employee")

urlpatterns = router.urls + [
    path("employee-picker/", EmployeePickerView.as_view(), name="employee-picker"),
]
