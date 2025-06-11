function toggleAdminStatus(checkbox) {
    if (checkbox.checked) {
        // Mostrar mensaje de confirmación
        if (confirm('¿Estás seguro de hacer este usuario Admin (Staff y Superusuario)?')) {
            // Buscar y marcar los checkboxes de staff y superuser
            document.querySelector('[name="is_staff"]').checked = true;
            document.querySelector('[name="is_superuser"]').checked = true;
        } else {
            checkbox.checked = false;
        }
    } else {
        document.querySelector('[name="is_staff"]').checked = false;
        document.querySelector('[name="is_superuser"]').checked = false;
    }
}

// También puedes añadir un botón HTML si prefieres
document.addEventListener('DOMContentLoaded', function() {
    const adminButton = document.createElement('button');
    adminButton.type = 'button';
    adminButton.className = 'button';
    adminButton.textContent = 'Hacer Admin';
    adminButton.style.marginLeft = '10px';
    adminButton.onclick = function() {
        const checkbox = document.querySelector('.admin-checkbox');
        checkbox.checked = !checkbox.checked;
        toggleAdminStatus(checkbox);
    };
    
    const checkboxContainer = document.querySelector('.form-row.field-make_admin');
    if (checkboxContainer) {
        checkboxContainer.appendChild(adminButton);
    }
});