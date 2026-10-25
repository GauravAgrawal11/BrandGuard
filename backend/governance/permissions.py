from functools import wraps
from django.http import JsonResponse
from rest_framework import permissions
from .auth import get_authenticated_user_from_request


class IsAdmin(permissions.BasePermission):
    """
    DRF permission class: Grants access strictly to users with role == 'ADMIN'.
    Writers calling an endpoint with this permission receive HTTP 403 Forbidden.
    """
    message = "Admin privileges required. Content writers are forbidden from performing this action."

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        return getattr(user, 'role', '') == 'ADMIN' or user.is_superuser


class IsWriter(permissions.BasePermission):
    """
    DRF permission class: Grants access to authenticated users with role == 'CONTENT_WRITER' or 'ADMIN'.
    """
    message = "Authentication as a Content Writer or Admin is required."

    def has_permission(self, request, view):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        return getattr(user, 'role', '') in ('CONTENT_WRITER', 'ADMIN') or user.is_superuser


def admin_required(view_func):
    """
    Decorator for standard Django views that enforces ADMIN access.
    Writers receive HTTP 403 Forbidden with a clear security response.
    Unauthenticated callers receive HTTP 401 Unauthorized.
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        user = get_authenticated_user_from_request(request)
        if not user:
            return JsonResponse({
                "error": "Unauthorized",
                "detail": "Authentication credentials were not provided or are invalid."
            }, status=401)

        request.user = user

        if getattr(user, 'role', '') != 'ADMIN' and not user.is_superuser:
            return JsonResponse({
                "error": "Forbidden",
                "detail": "Admin privileges required. Content writers cannot access this resource.",
                "user_role": getattr(user, 'role', 'UNKNOWN'),
            }, status=403)

        return view_func(request, *args, **kwargs)
    return wrapper


def writer_required(view_func):
    """
    Decorator for standard Django views that enforces authenticated writer or admin access.
    Unauthenticated callers receive HTTP 401 Unauthorized.
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        user = get_authenticated_user_from_request(request)
        if not user:
            return JsonResponse({
                "error": "Unauthorized",
                "detail": "Authentication credentials were not provided or are invalid."
            }, status=401)

        request.user = user

        if getattr(user, 'role', '') not in ('CONTENT_WRITER', 'ADMIN') and not user.is_superuser:
            return JsonResponse({
                "error": "Forbidden",
                "detail": "Content writer or Admin access required.",
            }, status=403)

        return view_func(request, *args, **kwargs)
    return wrapper
