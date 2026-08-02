from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.companies.serializers import CompanyMembershipSerializer

from .serializers import LoginSerializer, SignupSerializer, UserSerializer


@require_GET
@ensure_csrf_cookie
def csrf(request):
    """Frontend hits this once to receive a csrftoken cookie before any
    unsafe (POST/PATCH/DELETE) request — standard Django SPA pattern."""
    return JsonResponse({"csrfToken": get_token(request)})


class SignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        login(request, user)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            username=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )
        if user is None:
            return Response({"detail": "Invalid email or password."}, status=status.HTTP_401_UNAUTHORIZED)
        login(request, user)
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    def get(self, request):
        memberships = request.user.memberships.select_related("company").prefetch_related(
            "membership_roles__role__permissions"
        )
        return Response(
            {
                "user": UserSerializer(request.user).data,
                "memberships": CompanyMembershipSerializer(memberships, many=True).data,
                "active_company_id": request.company.id if request.company else None,
            }
        )
