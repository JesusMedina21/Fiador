from rest_framework import serializers
# from django.contrib.auth.models import User # Modelo original
from api.models import *
from django.utils.dateparse import parse_datetime
from django.utils.translation import gettext_lazy as _
from django.contrib.auth import get_user_model
from rest_framework.fields import SerializerMethodField
from decimal import Decimal

from rest_framework.response import Response
from rest_framework.exceptions import APIException

from collections import defaultdict
from rest_framework.utils.serializer_helpers import ReturnDict

from djoser import utils
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode

from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_str, force_bytes

User = get_user_model()

class ActivarEmailSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()

    def validate(self, attrs):
        try:
            uid = force_str(urlsafe_base64_decode(attrs['uid']))
            self.user = User.objects.get(pk=uid)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            raise serializers.ValidationError({"uid": "ID de usuario inválido"})

        if not default_token_generator.check_token(self.user, attrs['token']):
            raise serializers.ValidationError({"token": "Token inválido o expirado"})

        if not self.user.pending_email:
            raise serializers.ValidationError({"detail": "No hay cambio de email pendiente"})

        return attrs
class ActivarNuevoEmailSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()

    def validate(self, attrs):
        try:
            uid = force_str(urlsafe_base64_decode(attrs['uid']))
            self.user = User.objects.get(pk=uid)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            raise serializers.ValidationError({"uid": "ID de usuario inválido"})

        if not default_token_generator.check_token(self.user, attrs['token']):
            raise serializers.ValidationError({"token": "Token inválido o expirado"})

        if not self.user.pending_email:
            raise serializers.ValidationError({"detail": "No hay cambio de email pendiente"})

        return attrs

class ChangeEmailRequestSerializer(serializers.Serializer):
    new_email = serializers.EmailField()

class ForgotEmailSerializer(serializers.Serializer):
    recovery_email = serializers.EmailField()
    user = None

    def validate_recovery_email(self, value):
        try:
            user = User.objects.get(recovery_email=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("No existe un usuario con ese correo alternativo")
        self.user = user   # guardamos el usuario real
        return value

class ConfirmarEmailSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_email = serializers.EmailField()

    default_error_messages = {
        "invalid_token": "Token inválido o expirado",
        "invalid_uid": "Usuario inválido",
    }

    def validate(self, attrs):
        try:
            uid = utils.decode_uid(attrs["uid"])
            self.user = User.objects.get(pk=uid)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            raise serializers.ValidationError({"uid": self.default_error_messages["invalid_uid"]})

        return attrs
    
class UserCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email',  'recovery_email', 'username', 'password', 'first_name', 'last_name', 'biometric']
        extra_kwargs = {
            'password': {'write_only': True},
            'biometric': {'write_only': True},
        }
    def to_representation(self, instance):
       rep = super().to_representation(instance)
       rep['id'] = str(rep['id'])  # Asegúrate de que el id sea una cadena
       return rep
    def create(self, validated_data):
        barberia_data = validated_data.pop('barberia', None)
        user = User(**validated_data)
        user.set_password(validated_data['password'])
        user.save()
        if barberia_data:
            user.barberia = barberia_data
            user.save()
        return user


##################Users 

class CuentaSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
    # estos son los campos que quiero que se conviertan a json
        #fields = ['id', 'username', 'email', 'password']
        fields = ['id', 'username', 'email',  'recovery_email', 'password', 'biometric']
    #Validacion para no colocar campos adicionales en peticion POST/PATCH en herramientas como Postman
    def validate(self, data):
        model_fields = {field.name for field in User._meta.get_fields()}
        extra_fields = set(self.initial_data.keys()) - model_fields
        
        if extra_fields:
            raise serializers.ValidationError(
                f"Campos no permitidos: {', '.join(extra_fields)}. "
                f"Campos válidos: {', '.join(model_fields)}"
            )
        return data

class ProductoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Producto
    # estos son los campos que quiero que se conviertan a json
        fields = ['id', 'usuario', 'producto_nombre', 'precio']

    #Validacion para no colocar campos adicionales en peticion POST/PATCH en herramientas como Postman
    def validate(self, data):


        model_fields = {field.name for field in Producto._meta.get_fields()}
        extra_fields = set(self.initial_data.keys()) - model_fields
        
        if extra_fields:
            raise serializers.ValidationError(
                f"Campos no permitidos: {', '.join(extra_fields)}. "
                f"Campos válidos: {', '.join(model_fields)}"
            )
        
        # Validación para PATCH - solo permite precio y producto_nombre
        if self.context['request'].method == 'PATCH':
            allowed_fields = {'precio', 'producto_nombre'}
            provided_fields = set(self.initial_data.keys())
            
            # Verificar campos no permitidos
            invalid_fields = provided_fields - allowed_fields
            if invalid_fields:
                raise serializers.ValidationError(
                    f"Para actualizaciones PATCH solo se permiten: {', '.join(allowed_fields)}. "
                    f"Campos no permitidos: {', '.join(invalid_fields)}"
                )
        
        return data

    

    def create(self, validated_data):
        # Asigna automáticamente el usuario actual al crear
        validated_data['usuario'] = self.context['request'].user
        return super().create(validated_data)
    

class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
    # estos son los campos que quiero que se conviertan a json
        fields = ['id', 'fiador', 'cliente_nombre']

    #Validacion para no colocar campos adicionales en peticion POST/PATCH en herramientas como Postman
    def validate(self, data):
        model_fields = {field.name for field in Cliente._meta.get_fields()}
        extra_fields = set(self.initial_data.keys()) - model_fields
        
        if extra_fields:
            raise serializers.ValidationError(
                f"Campos no permitidos: {', '.join(extra_fields)}. "
                f"Campos válidos: {', '.join(model_fields)}"
            )
    
        # Validación para PATCH - solo permite precio y producto_nombre
        if self.context['request'].method == 'PATCH':
            allowed_fields = {'cliente_nombre'}
            provided_fields = set(self.initial_data.keys())
            
            # Verificar campos no permitidos
            invalid_fields = provided_fields - allowed_fields
            if invalid_fields:
                raise serializers.ValidationError(
                    f"Para actualizaciones PATCH solo se permiten: {', '.join(allowed_fields)}. "
                    f"Campos no permitidos: {', '.join(invalid_fields)}"
                )
        
        return data
    

# Nuevo serializador para el detalle del fiado (producto y cantidad)
class DetalleFiadoSerializer(serializers.ModelSerializer):
    # Puedes usar un SerializerMethodField para mostrar el nombre del producto
    producto_nombre = serializers.CharField(source='producto.producto_nombre', read_only=True)
    precio = serializers.DecimalField(source='producto.precio', max_digits=10, decimal_places=2, read_only=True)
    producto_id = serializers.PrimaryKeyRelatedField(
        queryset=Producto.objects.all(),
        source='producto', # Esto es importante para el mapeo correcto
        write_only=True    # El id del producto es solo para escritura
    )

    class Meta:
        model = DetalleFiado
        fields = ['producto_id', 'producto_nombre', 'precio', 'cantidad']
        # El campo 'id' no se necesita en la creación de detalle
        # extra_kwargs = {'id': {'read_only': True}} # Opcional: si quieres el id del detalle en la lectura

    def validate_producto_id(self, value):
        # Asegúrate de que el producto pertenezca al usuario que está registrando el fiado
        request_user = self.context['request'].user
        if not request_user.is_staff and value.usuario != request_user:
            raise serializers.ValidationError("No puedes agregar productos que no te pertenecen.")
        return value
    
class FiadoEliminado(APIException):
    status_code = 200
    default_detail = 'El fiado fue eliminado correctamente porque la deuda fue saldada.'
    default_code = 'fiado_eliminado'

class FiadoSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.CharField(source='cliente.cliente_nombre', read_only=True)
    # Aquí anidamos el serializador DetalleFiadoSerializer
    # Esto nos permite recibir y mostrar una lista de productos con sus cantidades
    productos = DetalleFiadoSerializer(source='detallefiado_set', write_only=True, many=True)
    deuda_pendiente = SerializerMethodField()
    deuda_total = serializers.SerializerMethodField()

    class Meta:
        model = Fiado
        # Incluye el nuevo campo 'productos'
        fields = ['id', 'cliente', 'cliente_nombre', 'productos', 'deuda_pendiente',  
        'interes', 'abono', 'monto_total', 'fecha_registro', 'deuda_total' ]
        read_only_fields = ['cliente_nombre', 'deuda_pendiente'] # El nombre del cliente es solo para lectura
        #El extra_kwargs, hace que este campo solo sea utilizado para la creacion del producto, mas no para leer
        #es decir que el write_only, significa,. pura escritura
        extra_kwargs = {
            'productos': {'write_only': True},
            'fecha_registro': {'write_only': True}
        }

    def validate_productos(self, value):
        if not value:
            raise serializers.ValidationError("Debe seleccionar al menos un producto.")
        return value

    # La validación 'validate' general debe ser más cuidadosa ahora que manejamos 'productos'
    def validate(self, data):
        # Validar campos no permitidos (revisado para incluir productos)
        model_fields = {field.name for field in Fiado._meta.get_fields()}
        # Agregamos 'productos' a los campos válidos para la validación
        valid_initial_data_fields = model_fields.union({'productos', 'cliente_nombre'})

        extra_fields = set(self.initial_data.keys()) - valid_initial_data_fields
        if extra_fields:
            raise serializers.ValidationError(
                f"Campos no permitidos: {', '.join(extra_fields)}. "
                f"Campos válidos: {', '.join(valid_initial_data_fields)}"
            )

        request = self.context.get('request')
        if request and request.method == 'PATCH':
            allowed_fields = {'monto_total', 'interes', 'fecha_registro', 'productos', 'abono'}
            provided_fields = set(self.initial_data.keys())
            invalid_fields = provided_fields - allowed_fields
            if invalid_fields:
                raise serializers.ValidationError(
                    f"Para actualizaciones PATCH solo se permiten: {', '.join(allowed_fields)}. "
                    f"Campos no permitidos: {', '.join(invalid_fields)}"
                )

            if 'cliente' in self.initial_data:
                raise serializers.ValidationError({'cliente': 'No puedes modificar el cliente en PATCH.'})
            
            if 'fecha_registro' not in self.initial_data:
                raise serializers.ValidationError({'fecha_registro': 'Este campo es obligatorio.'})


            # Validación de propiedad para productos en PATCH (se maneja en DetalleFiadoSerializer ahora)
            # Ya no es necesario aquí directamente, se delegará a DetalleFiadoSerializer

        # Asegúrate de retornar los datos al final
        return data

    def validate_cliente(self, value):
        # Validar que el cliente pertenezca al usuario actual
        if value.fiador != self.context['request'].user:
            raise serializers.ValidationError(
                "No puedes registrar fiados para clientes que no son tuyos"
            )
        return value

    def create(self, validated_data):
        productos_data = validated_data.pop('detallefiado_set')
        cliente = validated_data['cliente']


        # Obtener la fecha_registro desde el JSON manualmente
        fecha_registro_raw = self.initial_data.get("fecha_registro")
        if not fecha_registro_raw:
            raise serializers.ValidationError({"fecha_registro": "Este campo es obligatorio."})
        
        fecha_registro = parse_datetime(fecha_registro_raw)
        if not fecha_registro:
            raise serializers.ValidationError({"fecha_registro": "Formato inválido. Usa ISO 8601."})


    
        # Obtener o crear el fiado activo para este cliente
        fiado, _ = Fiado.objects.get_or_create(
            cliente=cliente,
            defaults=validated_data
        )
    
        # Si el fiado ya existía, no actualizar campos como interes, abono, etc.
        if not _:
            # O puedes actualizar solo si deseas
            fiado.interes = validated_data.get('interes', fiado.interes)
            fiado.monto_total += validated_data.get('monto_total', 0)
            fiado.save()
    
        # Obtener productos existentes en el fiado
        productos_existentes = {
            d.producto.id: d for d in fiado.detallefiado_set.all()
        }
    
        for detalle_data in productos_data:
            producto = detalle_data['producto']
            cantidad = detalle_data['cantidad']
    
            if producto.id in productos_existentes:
                # Si el producto ya existe, actualiza la cantidad
                detalle = productos_existentes[producto.id]
                detalle.cantidad += cantidad
                detalle.save()
            else:
                # Si es un producto nuevo, créalo
                DetalleFiado.objects.create(
                    fiado=fiado,
                    producto=producto,
                    cantidad=cantidad
                )
    
            # Crear nueva deuda pendiente solo para este producto (no duplicar las viejas)
            DeudaPendiente.objects.create(
                fiado=fiado,
                productos=producto,
                cantidad=cantidad,
                interes=fiado.interes,
                monto_total=(producto.precio * cantidad) + fiado.interes,
                abono=Decimal("0.00"),
                fecha_registro=fecha_registro
            )
    
        return fiado


    def get_deuda_pendiente(self, obj):
        agrupadas = defaultdict(list)
    
        for deuda in obj.deudapendiente_set.all().order_by('fecha_registro'):
            agrupadas[deuda.fecha_registro.isoformat()].append({
                "producto_nombre": deuda.productos.producto_nombre,
                "precio": str(deuda.productos.precio),
                "cantidad": deuda.cantidad,
                "interes": str(deuda.interes)
            })
    
        resultado = []
        for fecha, items in agrupadas.items():
            resultado.append({
                "fecha_registro": fecha,
                "items": items
            })
    
        return resultado
    
    def get_deuda_total(self, obj):
        return float(obj.monto_total - obj.abono)




    def update(self, instance, validated_data):
        # Lógica para actualizar el fiado y sus detalles de productos
        productos_data = validated_data.pop('detallefiado_set', None)

        # Actualizar campos del fiado
        instance.monto_total = validated_data.get('monto_total', instance.monto_total)
        instance.interes = validated_data.get('interes', instance.interes)
        instance.fecha_registro = validated_data.get('fecha_registro', instance.fecha_registro)
        instance.abono = validated_data.get('abono', instance.abono)
        instance.save()

        if productos_data is not None:
            # Eliminar detalles de productos existentes que no están en la nueva lista
            # Esto asume que si se envía una lista vacía, se eliminan todos los detalles
            # Si quieres un comportamiento diferente (solo añadir, no eliminar implícitamente), ajusta aquí
            current_product_ids = {d.producto.id for d in instance.detallefiado_set.all()}
            incoming_product_ids = {d['producto'].id for d in productos_data}

            for detalle_data in productos_data:
                producto = detalle_data['producto']
                cantidad = detalle_data['cantidad']
                # Si el producto ya existe en el fiado, actualiza la cantidad
                detalle_obj, created = DetalleFiado.objects.update_or_create(
                    fiado=instance, producto=producto,
                    defaults={'cantidad': cantidad}
                )

            # Eliminar detalles de productos que fueron removidos en la solicitud PATCH
            # Es decir, aquellos que estaban en el fiado pero no en la lista de la solicitud
            products_to_remove = current_product_ids - incoming_product_ids
            DetalleFiado.objects.filter(fiado=instance, producto__id__in=products_to_remove).delete()

        # Verificar si la deuda total es 0 y eliminar el fiado si aplica
        if instance.monto_total - instance.abono <= 0:
            instance.delete()
            raise FiadoEliminado()


        return instance

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')
        User = get_user_model()  # Obtiene el modelo de usuario actual
        try:
            user = User.objects.get(email=email)  # Busca el usuario por email
        except User.DoesNotExist:
            raise serializers.ValidationError(_('Invalid email or password.'))
        if not user.check_password(password):  # Verifica la contraseña
            raise serializers.ValidationError(_('Invalid email or password.'))
        
        attrs['user'] = user
        return attrs
    
# Nuevo serializador para el refresh token
class RefreshTokenSerializer(serializers.Serializer):
    refresh = serializers.CharField()