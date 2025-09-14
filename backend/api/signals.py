from django.db.models.signals import post_migrate
from django.contrib.auth.management import create_permissions

def block_default_permissions(sender, **kwargs):
    # Anula la función que crea permisos
    pass

# Desconectar la señal global
post_migrate.disconnect(receiver=create_permissions, dispatch_uid="django.contrib.auth.management.create_permissions")
