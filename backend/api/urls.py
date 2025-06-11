from django.urls import path,include
from rest_framework import routers
from api import views

from django.conf import settings
from django.conf.urls.static import static

router=routers.DefaultRouter()
router.register(r'fiado', views.FiadoViewSet) #endpoint   
router.register(r'user', views.UserViewSet)   #endpoint 
router.register(r'cliente', views.ClienteViewSet)   #endpoint 
router.register(r'producto', views.ProductoViewSet)   #endpoint 

urlpatterns=[
    path('', include(router.urls)),
]




if settings.DEBUG:
    #urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)