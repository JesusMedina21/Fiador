from django.apps import AppConfig
from django.contrib import admin

class ApiConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "api"
    verbose_name = 'Fiador Data'

    def ready(self):
        import api.signals

        # Importar aquí, no arriba
        from social_django.models import Association, Nonce, UserSocialAuth

        # desregistrar del admin
        try:
            admin.site.unregister(Association)
            admin.site.unregister(Nonce)
            admin.site.unregister(UserSocialAuth)
        except admin.sites.NotRegistered:
            pass
