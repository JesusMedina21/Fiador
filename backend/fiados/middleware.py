from django.http import HttpResponseForbidden
from django.conf import settings

class BlockPostmanMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user_agent = request.META.get('HTTP_USER_AGENT', '').lower()
        if 'postman' in user_agent:
            return HttpResponseForbidden("Acceso denegado")
        return self.get_response(request)
    
class CustomHeaderMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        self.exempt_paths = [
            '/admin/',    # Rutas que se pueden visualizar
            #'/api/docs/',    # Solo se puede usar en desarrollo, para produccion se comenta
            #'/api/schema/',  # Solo se puede usar en desarrollo, para produccion se comenta
        ]

    def __call__(self, request):
        # Verifica si la ruta está exenta
        if any(request.path.startswith(path) for path in self.exempt_paths):
            return self.get_response(request)
            
        # Verifica el header personalizado
        secret_header = request.headers.get(settings.SECURE_API_HEADER)
        if secret_header != settings.SECURE_API_VALUE:
            return HttpResponseForbidden("Acceso no autorizado")
            
        return self.get_response(request)