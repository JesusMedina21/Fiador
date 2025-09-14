from rest_framework import viewsets, status, generics
from api.serializers import *

# from django.contrib.auth.models import User # Modelo original
from api.models import *
# JWT
from rest_framework.permissions import IsAuthenticated, AllowAny

#DRF SPECTACULAR
from drf_spectacular.utils import extend_schema, extend_schema_view

from rest_framework.decorators import action
from rest_framework.response import Response

from api.permissions import *

from api.custom_email import *

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView as BaseTokenRefreshView

from djoser.views import UserViewSet
from djoser import signals
from djoser.conf import settings as djoser_settings
from django.db.utils import IntegrityError  # 👈 Importa esta excepción
from rest_framework.views import APIView
from django.core.mail import send_mail
from drf_spectacular.utils import (
    extend_schema,
    OpenApiResponse,
    inline_serializer
)
# En ConfirmarEmail (cuando mandas el correo al nuevo email)
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.views import View
from django.db import transaction
from django.shortcuts import render

class OAuthErrorView(View):
    template_name = 'oauth_error.html'
    
    def get(self, request, *args, **kwargs):
        error_message = request.GET.get('message', 'No puede iniciar con Google porque ya se creó una cuenta')
        return render(request, self.template_name, {'error_message': error_message})

@extend_schema(
    request=ActivarEmailSerializer,
    description='Confirma el nuevo email usando el UID y token del enlace'
)
class CustomUserViewSet(UserViewSet):
    
    def reset_password(self, request, *args, **kwargs):
        """
        Bloquea la solicitud de restablecimiento de contraseña para usuarios de Google.
        """
        # 1. Busca al usuario por el correo electrónico
        email_serializer = self.get_serializer(data=request.data)
        email_serializer.is_valid(raise_exception=True)
        email = email_serializer.validated_data.get("email")

        try:
            # ✅ CORRECTO: Usa el modelo de usuario importado
            user = User.objects.get(email=email)
            
            # 2. Verifica si el usuario tiene una cuenta social asociada
            if user.social_auth.exists():
                return Response(
                    {"detail": "No puedes restablecer la contraseña. Tu cuenta está registrada a través de Google."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # ✅ CORRECTO: Usa el modelo de usuario importado
        except User.DoesNotExist:
            # Si el usuario no existe, Djoser ya maneja este caso
            pass

        # 3. Si no es un usuario de Google, delega en la lógica original de Djoser.
        return super().reset_password(request, *args, **kwargs)
    
    def activation(self, request, *args, **kwargs):
        # Lógica de activación manual
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.user
        user.is_active = True
        user.save()

        # Enviar correo personalizado
        CustomActivationConfirmEmail(context={'user': user}).send(to=user.email)


        refresh = RefreshToken.for_user(user)
        return Response(
            {
            "detail": "¡Cuenta activada con éxito! Bienvenido a Fiador.",
                "tokens": {
                    "access": str(refresh.access_token),
                }
            },
            status=status.HTTP_200_OK
        )

@extend_schema(
    request=ActivarNuevoEmailSerializer,
    description='Confirma el nuevo email usando el UID y token del enlace'
)
class ActivarNuevoEmailView(APIView):
    def post(self, request, *args, **kwargs):
        serializer = ActivarNuevoEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.user

        if not user.pending_email:
            return Response(
                {"detail": "No hay cambio de email pendiente"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not default_token_generator.check_token(user, serializer.validated_data['token']):
            return Response(
                {"token": "Token inválido o expirado"},
                status=status.HTTP_400_BAD_REQUEST
            )

        new_email = user.pending_email
        old_email = user.email
        
        try:
            with transaction.atomic():
                user.email = new_email
                user.pending_email = None
                user.email_change_token = None
                user.save()
        except IntegrityError:
            return Response(
                {"detail": "Este correo electrónico ya está en uso"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Enviar notificaciones
        email_context = {
            'user': user,
            'new_email': new_email,
            'email': new_email,  # Añade esto para el template
            'old_email': old_email
        }

        confirmation_email = CustomActivationNewEmail(request, email_context)
        confirmation_email.send(to=[new_email])

        notification_email = CustomOldEmailNotification(request, email_context)
        notification_email.send(to=[old_email])

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "detail": "Email cambiado exitosamente",
                "tokens": {
                    "access": str(refresh.access_token),
                }
            },
            status=status.HTTP_200_OK
        )

@extend_schema(
    tags=["auth"],
    description="Envía un correo al usuario autenticado para confirmar el cambio de email.",
    request=ChangeEmailRequestSerializer,  # O ChangeEmailRequestSerializer si necesitas datos
    responses={
        200: OpenApiResponse(
            description="Correo enviado correctamente",
            response=inline_serializer(
                name="ChangeEmailResponse",
                fields={"detail": serializers.CharField()}
            )
        ),
        400: OpenApiResponse(description="El usuario está registrado con Google y no puede cambiar su email."),
        401: OpenApiResponse(description="No autenticado")
    }
)
class ChangeEmailView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user  # 🔹 El email ya viene del token JWT

        # 🔹 Lógica para bloquear el cambio si el usuario está asociado con una cuenta social
        if user.social_auth.exists():
            return Response(
                {"detail": "No puedes cambiar tu email. Tu cuenta está registrada a través de Google."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generar UID y token (igual que hace Djoser internamente)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)

        domain = settings.DOMAIN
        protocol = getattr(settings, "PROTOCOL", "http")

        # Usamos la URL de Djoser, no la hardcodeada
        relative_url = djoser_settings.USERNAME_RESET_CONFIRM_URL.format(uid=uid, token=token)
        confirm_url = f"{protocol}://{domain}/{relative_url}"

        # Contexto para el email
        context = {
            "user": user,
            "uid": uid,
            "token": token,
            "confirm_url": confirm_url,
        }

        # Enviar email con tu clase custom (respetando la URL de Djoser)
        activation_email = CustomUsernameResetEmail(request, context)
        activation_email.send(to=[user.email])

        return Response(
            {"detail": "Se ha enviado un correo con el enlace de confirmación"},
            status=status.HTTP_200_OK
        )

@extend_schema(
    request=ForgotEmailSerializer,
    description='Cambiar email olvidado'
)
class ForgotEmailView(APIView):
    permission_classes = []  # acceso público

    def post(self, request):
        serializer = ForgotEmailSerializer(data=request.data)
        if serializer.is_valid():
            recovery_email = serializer.validated_data["recovery_email"]
            user = User.objects.get(recovery_email=recovery_email)

            # Generar UID y token
            uid = urlsafe_base64_encode(force_bytes(user.pk))

            token = default_token_generator.make_token(user)

            # Dominio y protocolo desde settings.py
            domain = settings.DOMAIN
            protocol = getattr(settings, "PROTOCOL", "http")

            # 🚀 Usa el template de URL de DJOSER
            relative_url = djoser_settings.USERNAME_RESET_CONFIRM_URL.format(uid=uid, token=token)
            confirm_url = f"{protocol}://{domain}/{relative_url}"

            # Contexto para la plantilla
            email_context = {
                "user": user,
                "username": user.username,
                "confirm_url": confirm_url,
            }

            # Usamos la clase custom
            activation_email = CustomForgotEmail(request, email_context)
            activation_email.send(to=user.recovery_email)

            return Response(
                {"detail": "Se ha enviado un correo con el enlace de confirmación"},
                status=status.HTTP_200_OK
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@extend_schema(
    request=ConfirmarEmailSerializer,
    description='Confirma el cambio de email usando el UID y token del enlace'
)

class ConfirmarEmail(APIView):
    def post(self, request, *args, **kwargs):
        serializer = ConfirmarEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.user
        token = serializer.validated_data['token']
        new_email = serializer.validated_data["new_email"]

        if not default_token_generator.check_token(user, token):
            return Response(
                {"token": "Token inválido o expirado"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if User.objects.filter(email=new_email).exists():
            return Response(
                {"new_email": ["Este correo electrónico ya está en uso."]},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Guardamos directamente en los nuevos campos
        user.pending_email = new_email
        user.email_change_token = default_token_generator.make_token(user)
        user.save()

        email_context = {
            'user': user,
            'new_email': new_email,
            'old_email': user.email,
            'uid': urlsafe_base64_encode(force_bytes(user.pk)),
            'token': user.email_change_token
        }

        activation_email = CustomEmailReset(request, email_context)
        activation_email.send(to=[new_email])

        return Response(
            {"detail": "Se ha enviado un correo de confirmación al nuevo email"},
            status=status.HTTP_200_OK
        )

    
###################################3333333#USER###############################################

@extend_schema_view(
    list=extend_schema(tags=['User']),
    retrieve=extend_schema(tags=['User']),
    create=extend_schema(exclude=True),  # Excluye el create genérico
    methods=['POST'], tags=['User'], # 👈 Asegura que el método POST también tenga la etiqueta 'User'
    update=extend_schema(exclude=True),  # Oculta el método PUT (update)
    partial_update=extend_schema(tags=['User']),
    destroy=extend_schema(tags=['User']),
)

class CuentaViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = CuentaSerializer
    
    def get_queryset(self):
        if self.action == 'list':
            # Solo admin puede listar todos los usuarios
            if self.request.user.is_staff:
                return User.objects.all()
            return User.objects.filter(id=self.request.user.id)
        return super().get_queryset()


    def get_permissions(self):
        if self.action == 'register': # Esta linea significa que el endpoint register lo pueda usar cualquiera
            return [AllowAny()]  # Permitir registro sin autenticación
        elif self.action in ['retrieve', 'partial_update', 'destroy']:  
            # Permitir acceso a retrieve, update y destroy solo si el usuario está autenticado
           
            # Y que el resto de metodos usen IsAuthenticated que significa JWT y el IsSelf que significa
            # que el mismo usuario pueda acceder a su propio recurso, ejemplo el usuario 1 solo acceda al endpoint 1 
            return [IsAuthenticated(), MiUsuario()]  # 👈 Requiere autenticación y que sea el mismo usuario
        return [IsAuthenticated()]
    
    @extend_schema(exclude=True)  # 👈 Oculta este método del esquema Swagger
    def create(self, request, *args, **kwargs):
        return Response({"detail": "Método no permitido. Usa /api/user/register/."}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    @extend_schema(description="Registro de nuevos usuarios", tags=['User']) # 👈 Añade la etiqueta 'User' aquí
    @action(detail=False, methods=['post'], url_path='register')
    def register(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Crear usuario con contraseña hasheada
        user = User.objects.create_user(
            username=serializer.validated_data['username'],
            email=serializer.validated_data['email'],
            recovery_email=serializer.validated_data['recovery_email'],
            password=serializer.validated_data['password'],
            is_active=False  # ← CUENTA INACTIVA HASTA CONFIRMACIÓN
        )
        # ***** ENVIAR CORREO DE ACTIVACIÓN *****
        signals.user_registered.send(
            sender=self.__class__, user=user, request=self.request
        )
        
        # Usar el sistema de emails de Djoser
        if getattr(djoser_settings, 'SEND_ACTIVATION_EMAIL', True):
            context = {"user": user}
            # Asegúrate de que tienes configurado el email de activación en DJOSER['EMAIL']
            djoser_settings.EMAIL.activation(self.request, context).send([user.email])
        # ***************************************

        return Response(
            {
                "detail": "Usuario registrado. Por favor revise su email para activar la cuenta.",
                "user": CuentaSerializer(user).data
            },
            status=status.HTTP_201_CREATED
        )
   
    def update(self, request, *args, **kwargs):
        if not kwargs.get('partial', False):
            return Response(
                {"detail": "Método PUT no permitido. Use PATCH en su lugar."},
                status=status.HTTP_405_METHOD_NOT_ALLOWED
            )
        return super().update(request, *args, **kwargs)
    
    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs) 

###################################PRODUCTOS###############################################


@extend_schema_view(
    list=extend_schema(tags=['Producto']),
    retrieve=extend_schema(tags=['Producto']),
    update=extend_schema(exclude=True), # Oculta el método PUT (update)
    #Este codigo lo qeu dice es que solamente va a tener la propiedades precio y nombre 
    # y el usuario no se va a poder modifica en el metodo PATCH
    partial_update=extend_schema(
        tags=['Producto'],
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'producto_nombre': {'type': 'string'},
                    'precio': {'type': 'number'},
                },
                'required': []
            }
        }
    ),
    create=extend_schema(tags=['Producto']), 
    destroy=extend_schema(tags=['Producto']),
    
)


class ProductoViewSet(viewsets.ModelViewSet):
    queryset = Producto.objects.all()
    serializer_class = ProductoSerializer
    permission_classes = [IsAuthenticated, MiProducto] 

    def get_permissions(self):
        """
        Asigna permisos basados en la acción:
        - Todos los usuarios autenticados pueden crear y listar productos
        - Solo el dueño puede ver, editar o eliminar un producto específico
        """
        if self.action in ['retrieve', 'partial_update', 'destroy']:
            self.permission_classes = [IsAuthenticated, MiProducto]
        else:
            self.permission_classes = [IsAuthenticated]
        return super().get_permissions()
    
    def get_queryset(self):
        """
        Filtra los productos para que los usuarios solo vean los suyos
        (excepto si son staff, que pueden ver todos)
        """
        queryset = super().get_queryset()
        #Desarrollo
        #if not self.request.user.is_staff:
        #    queryset = queryset.filter(usuario=self.request.user)
        #return queryset

        #Produccion
        return queryset.filter(usuario=self.request.user)

    def update(self, request, *args, **kwargs):
        if not kwargs.get('partial', False):
            return Response(
                {"detail": "Método PUT no permitido. Use PATCH en su lugar."},
                status=status.HTTP_405_METHOD_NOT_ALLOWED
            )
        return super().update(request, *args, **kwargs)
    
    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs) 



###################################CLLIENTE###############################################

@extend_schema_view(
    list=extend_schema(tags=['Cliente']),
    retrieve=extend_schema(tags=['Cliente']),
    update=extend_schema(exclude=True),  # Oculta el método PUT (update)
    partial_update=extend_schema(
        tags=['Cliente'],
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'cliente_nombre': {'type': 'string'},
                },
                'required': []
            }
        }
    ),
    create=extend_schema(tags=['Cliente']),  
    destroy=extend_schema(tags=['Cliente']),
)
class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer
    permission_classes = [IsAuthenticated, MiCliente]

    def get_permissions(self):
            """
            Asigna permisos basados en la acción:
            - Todos los usuarios autenticados pueden crear y listar productos
            - Solo el dueño puede ver, editar o eliminar un producto específico
            """
            if self.action in ['retrieve', 'partial_update', 'destroy']:
                self.permission_classes = [IsAuthenticated, MiCliente]
            else:
                self.permission_classes = [IsAuthenticated]
            return super().get_permissions()
    
    def get_queryset(self):
        """
        Filtra los productos para que los Fiadores solo vean los suyos
        (excepto si son staff, que pueden ver todos)
        """
        queryset = super().get_queryset()
        #Desarrollo
        #if not self.request.user.is_staff:
        #    queryset = queryset.filter(fiador=self.request.user)
        #return queryset
        
        #Produccion
        return queryset.filter(fiador=self.request.user)
    
    def update(self, request, *args, **kwargs):
        if not kwargs.get('partial', False):
            return Response(
                {"detail": "Método PUT no permitido. Use PATCH en su lugar."},
                status=status.HTTP_405_METHOD_NOT_ALLOWED
            )
        return super().update(request, *args, **kwargs)
    
    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs) 




###################################3333333#FIADO###############################################

@extend_schema_view(
    list=extend_schema(tags=['Fiado']),
    retrieve=extend_schema(tags=['Fiado']),
    update=extend_schema(exclude=True),  # Oculta el método PUT (update)
    partial_update=extend_schema(
        tags=['Fiado'],
        request={
            'application/json': {
                'type': 'object',
                'properties': {
                    'productos': {
                        'type': 'array',
                        'items': {'type': 'integer'}
                    },
                    'fecha_registro': {'type': 'string', 'format': 'date-time'},
                    'monto_total': {'type': 'number'},
                    'interes': {'type': 'number'},
                    'abono': {'type': 'number'},
                },
                'required': []
            }
        }
    ),
    create=extend_schema(
        tags=['Fiado'],
        request=FiadoSerializer # Usamos el serializador completo para la creación
    ),
    destroy=extend_schema(tags=['Fiado']),
)
class FiadoViewSet(viewsets.ModelViewSet):
    queryset = Fiado.objects.all().order_by('-fecha_registro')  # El "-" indica DESC (más nuevo primero)
    serializer_class = FiadoSerializer
    permission_classes = [IsAuthenticated, MiFiado]


    def get_permissions(self):
        if self.action in ['retrieve', 'partial_update', 'destroy']:
            return [IsAuthenticated()]
        return [IsAuthenticated(), MiFiado()]
    
    def get_queryset(self):
        """
        Filtra los fiados para que cada usuario solo vea los suyos
        """
        queryset = super().get_queryset()
        return queryset.filter(cliente__fiador=self.request.user)  # Solo fiados del usuario actual

    def update(self, request, *args, **kwargs):
        if not kwargs.get('partial', False):
            return Response(
                {"detail": "Método PUT no permitido. Use PATCH en su lugar."},
                status=status.HTTP_405_METHOD_NOT_ALLOWED
            )
        return super().update(request, *args, **kwargs)
    
    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs) 


@extend_schema(tags=['Token'], request=RefreshTokenSerializer)
class TokenRefreshView(generics.GenericAPIView):
    serializer_class = RefreshTokenSerializer  # 👈 Serializador creado manualmente


    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data)
        serializer.is_valid(raise_exception=True)
        refresh = serializer.validated_data.get('refresh')

        if refresh:
            try:
                token = RefreshToken(refresh)
                access_token = token.access_token
                return Response({'access': str(access_token)}, status=status.HTTP_200_OK)
            except Exception as e:
                return Response({'error': 'Token inválido'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'error': 'Se requiere el token de refresco'}, status=status.HTTP_400_BAD_REQUEST)



@extend_schema(tags=['Login'])
class LoginView(generics.GenericAPIView):
    serializer_class = LoginSerializer
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        
        if not user.is_active:
            return Response(
                {"detail": "Tu cuenta no esta activa porque no has confirmado tu email. Por favor, revisa tu correo electrónico para activarla."},
                status=status.HTTP_401_UNAUTHORIZED
            )
        # Generar tokens
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }, status=status.HTTP_200_OK)
