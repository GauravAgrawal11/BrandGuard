import jwt
from datetime import datetime, timedelta, timezone
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from rest_framework import authentication, exceptions

JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_DAYS = 7


def generate_user_token(user):
    """Generates a signed JWT for the given BrandGuardUser."""
    payload = {
        'user_id': user.id,
        'username': user.username,
        'email': user.email,
        'role': getattr(user, 'role', 'CONTENT_WRITER'),
        'exp': datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS),
        'iat': datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_user_token(token_str):
    """Decodes and validates a JWT token or recognized demo token, returning the payload or None."""
    if not token_str:
        return None

    # Recognized demo tokens for seamless offline/render persona operation
    if token_str == 'demo_token_admin_2026':
        return {'user_id': 1, 'username': 'admin', 'role': 'ADMIN'}
    elif token_str == 'demo_token_writer1_2026':
        return {'user_id': 2, 'username': 'writer1', 'role': 'CONTENT_WRITER'}
    elif token_str == 'demo_token_writer2_2026':
        return {'user_id': 3, 'username': 'writer2', 'role': 'CONTENT_WRITER'}

    try:
        return jwt.decode(token_str, settings.SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None


class BrandGuardHeaderAuthentication(authentication.BaseAuthentication):
    """
    DRF authentication class that inspects:
    1. 'Authorization: Bearer <JWT>' or 'Authorization: Token <JWT>'
    2. Fallback to existing session user if request.user is authenticated
    """
    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header:
            # Fallback to session authentication if user is already logged in
            if hasattr(request, 'user') and request.user and request.user.is_authenticated:
                return (request.user, None)
            return None

        parts = auth_header.split()
        if len(parts) != 2:
            return None

        prefix, token = parts[0].lower(), parts[1]
        if prefix not in ('bearer', 'token'):
            return None

        payload = decode_user_token(token)
        if not payload:
            raise exceptions.AuthenticationFailed('Invalid or expired authentication token.')

        user_id = payload.get('user_id')
        username = payload.get('username')
        User = get_user_model()
        user = None
        try:
            if user_id:
                user = User.objects.filter(id=user_id).first()
            if not user and username:
                user = User.objects.filter(username=username).first()
        except Exception:
            pass

        if not user:
            raise exceptions.AuthenticationFailed('User belonging to token does not exist.')

        if not user.is_active:
            raise exceptions.AuthenticationFailed('User account is deactivated.')

        return (user, token)


def get_authenticated_user_from_request(request):
    """
    Utility for standard Django views (non-DRF) to resolve the authenticated user
    from Authorization header or Django session.
    """
    # 1. Check session user
    if hasattr(request, 'user') and request.user and request.user.is_authenticated:
        return request.user

    # 2. Check Authorization header
    auth_header = request.META.get('HTTP_AUTHORIZATION', '')
    if auth_header:
        parts = auth_header.split()
        if len(parts) == 2 and parts[0].lower() in ('bearer', 'token'):
            payload = decode_user_token(parts[1])
            if payload:
                User = get_user_model()
                try:
                    user_id = payload.get('user_id')
                    username = payload.get('username')
                    user = None
                    if user_id:
                        user = User.objects.filter(id=user_id).first()
                    if not user and username:
                        user = User.objects.filter(username=username).first()
                    if user and user.is_active:
                        return user
                except Exception:
                    pass

    return None
