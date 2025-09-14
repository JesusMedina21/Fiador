from django.urls import path,include
from rest_framework import routers
from api import views
from .views import *

from django.conf import settings
from django.conf.urls.static import static

router=routers.DefaultRouter()
router.register(r'fiado', views.FiadoViewSet) #endpoint   
router.register(r'user', views.CuentaViewSet)   #endpoint 
router.register(r'cliente', views.ClienteViewSet)   #endpoint 
router.register(r'producto', views.ProductoViewSet)   #endpoint 

urlpatterns=[
    path('', include(router.urls)),
    # Endpoints personalizados de Djoser
    path('auth/activate/', CustomUserViewSet.as_view({'post': 'activation'}), name='user-activation'),
    path('auth/activate/new-email/', ActivarNuevoEmailView.as_view(), name='activation-new-email'),
    path('auth/change/email/', ChangeEmailView.as_view(), name='email-reset'),
    path('auth/reset/email/', ForgotEmailView.as_view(), name='forgot-email'),
    path('auth/email/confirm/', ConfirmarEmail.as_view(), name='reset-email-confirm'), 
    path('auth/reset/password/', CustomUserViewSet.as_view({'post': 'reset_password'}), name='password-reset'),
    path('auth/reset/password/confirm/', UserViewSet.as_view({'post': 'reset_password_confirm'}), name='password-reset-confirm'),
    path('oauth-error/', OAuthErrorView.as_view(), name='oauth-error'),
    path('auth/o/', include('social_django.urls', namespace='social')),  # << importante
    #La ruta de auth/o es api/auth/o/login/google-oauth2/
]




if settings.DEBUG:
    #urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)