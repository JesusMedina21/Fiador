from django.db import models
# from django.contrib.auth.models import User # Modelo original
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator

class User(AbstractUser):
    #Biometric es el campo que va a necesitar los usuarios para almacenar la huella
    #y pueda iniciar sesion con la huella, biometric guarda sus credenciales como
    #email y password
    biometric = models.CharField(max_length=255, null=True, blank=True)
    #aqui modifico el username para que sea obligatorio pero no unico, 
    #es decir que pueda registrar 2 usuarios con el mismo nombre
    username = models.CharField(max_length=150, unique=False, blank=False, null=False)
    #aqui tengo que indicar por exigencias de Django, que al nombre ya no ser unico
    #lo que va a identificar el usuario como ID seria el email, por lo tanto tengo que
    #sobreescribir el campo email y e identificar el email en USERNAME_FIELD y colocar el
    #REQUIRED_FIELDS a juro porque sino, el codigo no va a funcionar por exigencias del framework
    email = models.EmailField(unique=True)
    USERNAME_FIELD = 'email' 
    REQUIRED_FIELDS = ['username'] 
    
    class Meta:
        # Asegúrate de que no haya restricciones de unicidad
        unique_together = ()  


class Producto(models.Model):
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='usuario', blank=False)
    precio = models.DecimalField(max_digits=10, decimal_places=2, blank=False)  # Acepta números decimales
    producto_nombre = models.CharField(max_length=50, blank=False)

    class Meta:
        # Restriccion para que un usuario no pueda registrar varios productos con el mismo nombre
        #Si el producto pertenece a el, el producto puede tener varias veces el mismo nombre si pertenece
        #a usuarios diferentes 
        unique_together = ('usuario', 'producto_nombre')
        ordering = ['-id']  # Ordenar por ID descendente

    def __str__(self):
        return self.producto_nombre



class Cliente(models.Model):
    fiador = models.ForeignKey(User, on_delete=models.CASCADE, related_name='fiador', blank=False)
    cliente_nombre = models.CharField(max_length=50, blank=False)

    def __str__(self):
        return self.cliente_nombre
    
    class Meta:
        #Este codigo hace que solamente el nombre del cliente sea unico si pertenece al mismo fiador
        unique_together = ('fiador', 'cliente_nombre')
        ordering = ['-id']  # Ordenar por ID descendente


class Fiado(models.Model):
    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE,  related_name='cliente', blank=False)
    # ¡Importante! Aquí cambiamos la relación ManyToManyField
    # Ahora usamos 'through' para especificar nuestro modelo intermedio
    productos = models.ManyToManyField(Producto, through='DetalleFiado', related_name='fiados')
    # Ahora usamos 'through' para especificar nuestro modelo intermedio
    deuda_pendiente = models.ManyToManyField(Producto, through='DeudaPendiente', related_name='deudas_pendientes')
    monto_total = models.DecimalField(
    max_digits=10, 
    decimal_places=2, 
    blank=False,
    null=False,
    validators=[MinValueValidator(0.01)]
)
    abono = models.DecimalField(
    max_digits=10, 
    decimal_places=2, 
    blank=True,
    null=True,
)
    interes = models.DecimalField(max_digits=10, decimal_places=2) 
    fecha_registro = models.DateTimeField() 

    def __str__(self):
        #return f"{self.cliente}" 
        return f"Fiado de {self.cliente.cliente_nombre} - {self.monto_total}"
    
    class Meta:
        ordering = ['cliente']

    def clean(self):
        if self.monto_total <= 0:
            from django.core.exceptions import ValidationError
            raise ValidationError({'monto_total': 'El monto total debe ser mayor que 0'})
        if not self.pk and not self.productos.exists():
            raise ValidationError({'productos': 'Debe seleccionar al menos un producto.'})
    
# Nuevo modelo intermedio para la relación Many-to-Many con cantidad
class DetalleFiado(models.Model):
    fiado = models.ForeignKey(Fiado, on_delete=models.CASCADE)
    producto = models.ForeignKey(Producto, on_delete=models.CASCADE)
    cantidad = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])


# Nuevo modelo intermedio para la relación Many-to-Many con cantidad
class DeudaPendiente(models.Model):
    fiado = models.ForeignKey(Fiado, on_delete=models.CASCADE)
    productos = models.ForeignKey(Producto, on_delete=models.CASCADE)
    cantidad = models.PositiveIntegerField(default=1, validators=[MinValueValidator(1)])  # Añade este campo
    interes = models.DecimalField(max_digits=10, decimal_places=2) 
    monto_total = models.DecimalField(
    max_digits=10, 
    decimal_places=2, 
    blank=False,
    null=False,
    validators=[MinValueValidator(0.01)]
    )
    abono = models.DecimalField(
    max_digits=10, 
    decimal_places=2, 
    blank=False,
    null=False,
    )


