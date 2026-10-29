# NEXO: cuentas y notificaciones — 2026-10-29

## Aplicado
- Centro interno existente completado con consultas autenticadas y filtro explícito por usuario, 20 resultados por página, filtro no leídas, actualización cada 30 segundos y marcado individual/global.
- Destinos limitados a rutas existentes; enlaces externos, barras invertidas y credenciales OAuth no se propagan. Un destino inválido muestra alternativa segura.
- Retorno de correo y Google comparte validación; confirmación de correo retorna a la página pública de acceso. Se evita competir con el retorno de la página de acceso.
- Menú usa «Subastar» sin cambiar rol ni URL existentes.

## Ejecutado
- Vitest: 5 archivos, 24 pruebas aprobadas; 6 pruebas nuevas de destinos.
- ESLint de 7 archivos modificados: cero errores; 3 advertencias de exports de React Fast Refresh en auth.tsx.
- Navegador con sesión real del solicitante: /auth?redirect=/notificaciones vuelve exactamente a /notificaciones, filtro no leídas y actualizar funcionan en estado vacío, menú Subastar visible y Administración oculto, cierre de sesión vuelve a /auth.
- Escritorio 1280×1800 y móvil 390×844: capturas revisadas, sin desbordamiento móvil ni errores JavaScript.
- Políticas activas de notifications consultadas: SELECT/UPDATE/DELETE propios por auth.uid(); ningún permiso INSERT para participantes. No se cambiaron permisos.

## No verificado
La cuenta disponible no tiene avisos. No se inventaron ni insertaron notificaciones presentadas como reales. Quedan lectura/marcado con avisos reales, aislamiento entre dos cuentas, eventos completos, enlaces eliminados a nivel de recurso, registro/verificación real de correo, recuperación real y push. No se verificó disponibilidad de un proveedor push.

Pagos administrativos siguen pendientes de sesión administradora autorizada. Servicios con decisión del cliente, operaciones/chat y demás prioridades del roadmap no se completaron en este incremento.

Sin publicación, cambios a métodos reales, nuevas migraciones ni servicios externos activados.