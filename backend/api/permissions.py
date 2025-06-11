from rest_framework.permissions import BasePermission, SAFE_METHODS

"""
Este CODIGO ES SOLAMENTE PARA QUE USUARIOS SI SON ADMINS puedan obtener 
las listas de todos los usuarios, eliminar o editar todos los usuarios
O para que un usuario solamente pueda editar su propia informacion 
"""


class MiUsuario(BasePermission):

    def has_object_permission(self, request, view, obj):
        # Permite a superusuarios/staff cualquier acción
        if request.user.is_superuser or request.user.is_staff:
            return True
            
        # Permite al dueño de su propia cuenta cualquier acción
        return obj.id == request.user.id


class MiProducto(BasePermission):

    def has_object_permission(self, request, view, obj):
        # Permite a superusuarios/staff cualquier acción
        if request.user.is_superuser or request.user.is_staff:
            return True
            
        # Permite al dueño del producto cualquier acción
        return obj.usuario == request.user

class MiCliente(BasePermission):

    def has_object_permission(self, request, view, obj):
        # Permite a superusuarios/staff cualquier acción
        if request.user.is_superuser or request.user.is_staff:
            return True
            
        # Permite al dueño solamente poder manejar sus propiso clientes cualquier acción
        return obj.fiador == request.user


class MiFiado(BasePermission):

    """
    Permite acceso AL FIADO si:
    - El fiado que voy a registrar se lo voy asignar a uno de mis clientes
    - Cualquier usuario superstaff puede hacer modificaciones 
    """
    def has_object_permission(self, request, view, obj):
        return (request.user.is_superuser or 
                request.user.is_staff or 
                obj.cliente.fiador == request.user)
