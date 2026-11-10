# NEXO: pendientes autorizados del 10 de noviembre

## Cambios
1. **Inicio con galería:** extraer el catálogo existente a una vista compartida para `/` y `/subastas`, sin duplicar consultas, filtros, destacadas ni scroll infinito. Conservar exploración anónima y acceso protegido para acciones privadas. Actualizar los datos de búsqueda y enlaces sociales de la raíz.
2. **Ficha de artículos:** ampliar el catálogo de categorías y subcategorías solicitado, con definiciones de atributos configurables y valores estructurados. Mostrar únicamente campos pertinentes, sin rellenarlos ni afirmar verificación. Mantener independiente el formulario de servicios y conservar publicaciones antiguas.
3. **Publicaciones propias:** separar activas, borradores y «Finalizadas sin ofertas / Pendientes de renovar». Confirmar renovación/republicación y retirada individual; reutilizar las operaciones seguras existentes, creando un registro nuevo y conservando toda evidencia histórica. Comprobar el historial público de adjudicadas.
4. **Auditoría push:** probar el payload real y el worker con imagen, sin imagen y enlaces con ventanas abiertas/cerradas, usando simulaciones sin envíos. Comprobar miniaturas públicas y deduplicación del pipeline; corregir solo fallos concretos.
5. **Regresiones:** conservar íntegramente el acuerdo privado y cierre mutuo de 0038, ejecutar pruebas dirigidas y suite relevante, y revisar escritorio/móvil y filtros entre lotes.

## Detalles técnicos
- Taxonomía y definiciones de atributos persistentes, extensibles y protegidas; migración aditiva mediante la herramienta de migraciones, con permisos explícitos y validación del lado servidor/DB.
- Lectura pública de atributos sin reservas, presupuestos ni información de operaciones; conservar la barrera de seguridad de `auctions_safe`.
- No ejecutar manualmente compilación ni comprobación de tipos: la plataforma las ejecuta automáticamente; reportar sus resultados disponibles y los comandos de pruebas ejecutados.
- No modificar membresías, motor, dominio, secretos, proveedores, cron ni activación push. Sin publicación, despliegue, envíos reales o borrado de datos históricos.

## Validación y límites
- Probar reglas nuevas con datos aislados, no actividad ficticia en cuentas reales.
- Revisar si hay una sesión propia disponible; no seleccionar otras cuentas sin autorización.
- La recepción física de push requiere un Android real y no se afirmará a partir de simulaciones ni aceptación HTTP.
- Si Lovable bloquea por saldo/créditos, detenerse y reportar el bloqueo, sin vías alternativas.
- Entregar archivos y migraciones exactos, pruebas aprobadas/fallidas y verificaciones pendientes.