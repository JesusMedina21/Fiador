from django.contrib import admin
from django.contrib.auth.models import Group
from .models import *
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django import forms
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe

from social_django.models import UserSocialAuth
# Desregistrar el modelo original de social_django
try:
    admin.site.unregister(UserSocialAuth)
except admin.exceptions.NotRegistered:
    pass

class UserSocialAuthProxy(UserSocialAuth):
    class Meta:
        proxy = True
        app_label = 'social_django'  # 👈 importante
        verbose_name = 'Usuario OAuth2'
        verbose_name_plural = 'Usuarios OAuth2'

@admin.register(UserSocialAuthProxy)
class UserSocialAuthProxyAdmin(admin.ModelAdmin):
    list_display = ('user', 'id', 'provider')
    readonly_fields = ('created', 'modified')
    search_fields = ('user__username', 'provider', 'uid')
    raw_id_fields = ('user',)

    fieldsets = (
        (None, {
            'fields': ('user', 'provider', 'uid', 'extra_data', 'created', 'modified')
        }),
    )

    def delete_queryset(self, request, queryset):
        for obj in queryset:
            user_to_delete = obj.user
            if user_to_delete:
                user_to_delete.delete()
            obj.delete()
class UserCreationForm(forms.ModelForm):
    password1 = forms.CharField(label='Contraseña', widget=forms.PasswordInput)
    password2 = forms.CharField(label='Confirmar contraseña', widget=forms.PasswordInput)
    make_admin = forms.BooleanField(
        label='Admin',
        required=False,
        help_text='Obtiene todos los permisos de la API y sus usuarios'
    )

    class Meta:
        model = User
        fields = ('username', 'email', 'recovery_email', 'is_active', 'make_admin')

    def clean_password2(self):
        password1 = self.cleaned_data.get("password1")
        password2 = self.cleaned_data.get("password2")
        if password1 and password2 and password1 != password2:
            raise forms.ValidationError("Las contraseñas no coinciden")
        return password2

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password1"])
        
        if self.cleaned_data['make_admin']:
            user.is_staff = True
            user.is_superuser = True
        
        if commit:
            user.save()
        return user

class UserChangeForm(forms.ModelForm):
    class Meta:
        model = User
        fields = '__all__'

    
    def save(self, commit=True):
        user = super().save(commit=False)
        # Solo aplicar set_password si el password realmente cambió
        if "password" in self.changed_data:
            user.set_password(self.cleaned_data["password"])  # ¡Importante!
        if commit:
            user.save()
        return user

class UserAdmin(BaseUserAdmin):
    add_form = UserCreationForm
    form = UserChangeForm  # Añade el formulario para edición

    ordering = ('-date_joined',)
    list_display = ('username', 'email', 'date_joined', 'is_staff', 'is_active')
    readonly_fields = ('date_joined', )

    add_form = UserCreationForm
    form = UserChangeForm  # Añade el formulario para edición
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'email', 'recovery_email', 'password1', 'password2', 
                      'is_active', 'make_admin'),
        }),
    )
    
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Información personal', {'fields': ('email', 'recovery_email', 'date_joined')}),
        ('Permisos', {
            'fields': ('is_active', 'is_staff', 'is_superuser'),
        }),
    )

    def get_form(self, request, obj=None, **kwargs):
        """
        Usa el formulario especial para creación pero el estándar para edición
        """
        defaults = {}
        if obj is None:  # Es creación
            defaults['form'] = self.add_form
        else:  # Es edición
            defaults['form'] = self.form
            
        defaults.update(kwargs)
        form = super().get_form(request, obj, **defaults)
        
        # Solo añade el evento onchange para el campo make_admin si existe
        if 'make_admin' in form.base_fields:
            form.base_fields['make_admin'].widget.attrs.update({
                'class': 'admin-checkbox',
                'onchange': 'toggleAdminStatus(this)'
            })
            
        return form

    class Media:
        js = ('admin/js/user_admin.js',)


class DetalleFiadoInline(admin.TabularInline):
    model = DetalleFiado
    extra = 1
    fields = ('producto', 'cantidad')
    readonly_fields = ('producto', 'cantidad')
class DeudaPendienteInline(admin.TabularInline):
    model = DeudaPendiente
    extra = 0
    fields = ('fecha_registro', 'productos', 'cantidad', 'interes', 'monto_total', 'abono')
    readonly_fields = fields
    
    def has_add_permission(self, request, obj=None):
        return False
    
    def has_delete_permission(self, request, obj=None):
        return False

class FiadoAdmin(admin.ModelAdmin):
    list_display = ('id', 'cliente_info', 'fiador_info', 'monto_total_display', 'abono_display', 'deuda_total_display', 'fecha_registro_display')
    list_filter = ('cliente__fiador', 'fecha_registro')
    search_fields = ('cliente__cliente_nombre', 'cliente__fiador__username', 'cliente__fiador__email')
    readonly_fields = ('deuda_total_display', 'fecha_registro_display')
    inlines = [DeudaPendienteInline]
    
    fieldsets = (
        (None, {
            'fields': ('cliente', 'fecha_registro_display')
        }),
        ('Información Financiera', {
            'fields': ('monto_total', 'abono', 'interes', 'deuda_total_display')
        }),
    )

    def cliente_info(self, obj):
        return obj.cliente.cliente_nombre
    cliente_info.short_description = 'Cliente'

    def fiador_info(self, obj):
        return f"{obj.cliente.fiador.username} ({obj.cliente.fiador.email})"
    fiador_info.short_description = 'Fiador'

    def fecha_registro_display(self, obj):
        return obj.fecha_registro.strftime('%Y-%m-%d %H:%M')
    fecha_registro_display.short_description = 'Fecha de Registro'

    def monto_total_display(self, obj):
        return f"${obj.monto_total}"
    monto_total_display.short_description = 'Monto Total'

    def abono_display(self, obj):
        return f"${obj.abono if obj.abono else '0.00'}"
    abono_display.short_description = 'Abono'

    def deuda_total_display(self, obj):
        deuda_total = float(obj.monto_total) - float(obj.abono if obj.abono else 0)
        return f"${deuda_total:.2f}"
    deuda_total_display.short_description = 'Deuda Total'

    def get_readonly_fields(self, request, obj=None):
        if obj:  # Cuando se edita un objeto existente
            return self.readonly_fields + ('cliente', 'monto_total', 'interes')
        return self.readonly_fields

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'cliente', 'cliente__fiador'
        ).prefetch_related('deuda_pendiente')
# Registra los modelos
admin.site.register(Fiado, FiadoAdmin)
admin.site.register(User, UserAdmin)
admin.site.register(Producto)
admin.site.register(Cliente)
admin.site.unregister(Group)