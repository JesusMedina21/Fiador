import requests
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
import logging
logger = logging.getLogger(__name__)
User = get_user_model()
from django.shortcuts import redirect
from urllib.parse import urlencode
from django.http import HttpResponseRedirect, HttpResponse
from social_core.exceptions import AuthException
from django.urls import reverse
from django.db import IntegrityError

class AccountAlreadyExists(AuthException):
    """Excepción personalizada para cuentas ya existentes"""
    def __init__(self, backend, email):
        super().__init__(backend, f"Ya existe una cuenta con el email {email}")

def ensure_unique_association(backend, details, response, *args, **kwargs):
    """
    Forzar que cada email único cree un usuario nuevo
    """
    email = details.get('email')
    if not email:
        return {}
    
    #print(f"📧 Processing email: {email}")
    
    # Buscar si ya existe un usuario con este email
    try:
        existing_user = User.objects.get(email=email)
        #print(f"✅ Usuario existente: {existing_user.email} (ID: {existing_user.id})")
        
        # Verificar si ya está asociado con este backend
        from social_django.models import UserSocialAuth
        try:
            social = UserSocialAuth.objects.get(provider=backend.name, user=existing_user)
            #print(f"📎 Usuario ya está asociado con {backend.name}")
            return {
                'user': existing_user,
                'is_new': False
            }
        except UserSocialAuth.DoesNotExist:
            # Usuario existe pero no está asociado con Google - ERROR
            print(f"🚫 ERROR: Ya existe cuenta con {email} pero no está asociada a Google")
            raise AccountAlreadyExists(backend, email)
            
    except User.DoesNotExist:
        print(f"🆕 Nuevo usuario: {email}")
        # Dejar que el pipeline continúe y cree nuevo usuario
        return {}

def custom_associate_user(backend, details, response, *args, **kwargs):
    """
    Reemplazo del associate_user original para prevenir conflictos
    """
    email = details.get('email')
    uid = kwargs.get('uid')
    
    print(f"🔗 Custom associate: {email} (UID: {uid})")
    
    if not email or not uid:
        return {}
    
    # Buscar asociación existente por UID (no por email)
    try:
        from social_django.models import UserSocialAuth
        social = UserSocialAuth.objects.get(provider=backend.name, uid=uid)
        #print(f"📎 Asociación existente encontrada: {social.uid} -> User {social.user_id}")
        return {
            'user': social.user,
            'is_new': False
        }
    except UserSocialAuth.DoesNotExist:
        # Verificar si el email ya existe en la base de datos
        try:
            existing_user = User.objects.get(email=email)
            print(f"🚫 ERROR: Email {email} ya existe pero no está asociado a Google")
            raise AccountAlreadyExists(backend, email)
        except User.DoesNotExist:
            #print("🆕 Nueva asociación requerida - llamando a associate_user original")
            # Dejar que social_core maneje la asociación normalmente
            return {}
    
def prevent_user_overwrite(backend, details, response, user=None, *args, **kwargs):
    """
    Prevenir que un usuario existente sea sobrescrito
    """
    if user and user.pk:
        email = details.get('email')
        if email and email != user.email:
            print(f"🚫 ALERTA: Intento de sobrescribir usuario {user.email} con {email}")
            # Forzar creación de nuevo usuario en lugar de sobrescribir
            return {
                'user': None,
                'is_new': True
            }
    return {}
def handle_duplicate_email(strategy, details, response, user=None, *args, **kwargs):
    """
    Maneja específicamente el error de email duplicado
    """
    email = details.get('email')
    if not email:
        return {}
    
    try:
        # Verificar si ya existe un usuario con este email
        existing_user = User.objects.get(email=email)
        
        # Verificar si ya está asociado con Google
        from social_django.models import UserSocialAuth
        try:
            social = UserSocialAuth.objects.get(provider='google-oauth2', user=existing_user)
            # Si ya está asociado, continuar normalmente
            return {'user': existing_user, 'is_new': False}
        except UserSocialAuth.DoesNotExist:
            # Usuario existe pero no está asociado a Google - REDIRIGIR A ERROR
            print(f"🚫 REDIRIGIENDO: Email {email} ya existe en sistema")
            
            # Construir URL de error
            error_url = reverse('oauth-error') + f'?message=No puede iniciar con Google porque ya se creó una cuenta con el email {email}. Por favor inicia sesión con tu contraseña.'
            
            # Redirigir inmediatamente
            return HttpResponseRedirect(error_url)
            
    except User.DoesNotExist:
        # No existe usuario, continuar normalmente
        return {}
    
def social_auth_exception_handler(backend, strategy, details, response, exception, *args, **kwargs):
    """
    Maneja excepciones específicas del proceso de autenticación social
    """
    if isinstance(exception, AccountAlreadyExists):
        # Construir URL de error
        error_url = reverse('oauth-error') + f'?message={str(exception)}'
        return HttpResponseRedirect(error_url)
    
    elif isinstance(exception, IntegrityError) and 'duplicate key value violates unique constraint' in str(exception):
        # Capturar errores de integridad de base de datos
        email = details.get('email', '')
        error_url = reverse('oauth-error') + f'?message=No puede iniciar con Google porque ya se creó una cuenta con el email {email}'
        return HttpResponseRedirect(error_url)
    
    # Re-lanzar otras excepciones para que Django las maneje normalmente
    raise exception 
def print_jwt_token(strategy, details, response, user=None, *args, **kwargs):
    """
    NUEVO: Genera y muestra el token JWT en la consola
    """
    if user and user.is_authenticated:
        try:
            # Generar token JWT
            refresh = RefreshToken.for_user(user)
            access_token = str(refresh.access_token)
            
            # Imprimir en consola del backend (Django)
            print("\n" + "="*60)
            print("🔥 TOKEN JWT GENERADO PARA USUARIO SOCIAL 🔥")
            print("="*60)
            print(f"Usuario: {user.email}")
            print(f"User ID: {user.id}")
            print(f"Access Token: {access_token}")
            print(f"Refresh Token: {str(refresh)}")
            print("="*60)
            
            # También guardar en la sesión por si acaso
            strategy.session_set('jwt_access_token', access_token)
            strategy.session_set('jwt_refresh_token', str(refresh))
            
        except Exception as e:
            print(f"❌ Error generando JWT: {e}")
    
    return {'user': user}

def is_ionic_app(request):
    # Detectar si la solicitud viene de la app de Ionic/Capacitor
    user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
    return 'capacitor' in user_agent or 'ionic' in user_agent


def redirect_with_token(strategy, details, response, user=None, *args, **kwargs):
    if user and user.is_authenticated:
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        request = strategy.request
        source_param = request.GET.get('source', '')
        is_from_mobile_app = source_param == 'mobile_app' or is_ionic_app(request)

        if is_from_mobile_app:
            redirect_uri = 'fiador://google/callback'
        else:
            # 🔹 Aquí va tu página que se cierra sola
            redirect_uri = 'https://fiador.vercel.app/google/callback'

        params = urlencode({
            'access': access_token,
            'refresh': refresh_token
        })

        return HttpResponseRedirect(f'{redirect_uri}?{params}')

    return {'user': user}
