# NEXO: cuentas y notificaciones — 2026-10-29

## Corrección autorizada exclusiva de notificaciones — 2026-11-06

- Permiso nativo desde una oferta contextual única al abrir el centro de notificaciones, con gesto explícito. No se repite tras rechazar/cerrar la oferta ni tras denegación del navegador. Permiso ya concedido: registro automático; revocación: detección en cambios de permiso, foco, visibilidad y reconexión, con desactivación del endpoint del dispositivo conocido. Preferencias independientes del permiso.
- Eliminados los tres botones persistentes de gestión de dispositivos y la selección de categorías. Primera vinculación inicializa avisos de todas las nuevas subastas; cambios posteriores de preferencias se conservan.
- Publicación: evento único por subasta, solo alta activa o transición draft/scheduled → active. Todos los usuarios que aceptan nuevas subastas con dispositivos Web Push activos/no caducados (también el vendedor), sin categorías. Una notificación por usuario y una cola por dispositivo, sin repetición por ediciones. Pujas/chat/operaciones conservan el flujo existente.
- Borrado individual de leída y borrado de todas las leídas con confirmación; RPC autenticado restringido al propietario y a read=true, sin límite de página. Limpia referencias de cola primero. Borrado directo revocado para evitar borrar no leídas desde el cliente.
- Migración aplicada: `drizzle/migrations/0030_notification_consent_publication_read_cleanup.sql`; verificados disparador INSERT/UPDATE y permisos reales (anon sin RPC, authenticated con RPC y sin DELETE directo).
- Archivos: `src/components/PushLifecycle.tsx`, `PushLifecycle.test.tsx`, `PushPreferences.tsx`; `src/lib/push.ts`, `push.test.ts`, `push.functions.ts`, `notifications.functions.ts`, `notifications.sql.test.ts`; `src/routes/__root.tsx`, `src/routes/_authenticated/notificaciones.tsx`; tipos regenerados; documentación y regla de arquitectura actualizadas.
- Suite disponible: 127/127 aprobadas; PostgreSQL desechable prueba deduplicación, categorías ignoradas, publicación/no borradores, expiración, aislamiento y borrado de 45 leídas entre páginas, protección de no leídas y actividad independiente. Pruebas de permiso/sincronización utilizan dobles controlados, no teléfono real.
- Navegador real autenticado: `/notificaciones`, preferencias modificadas/recargadas y restauradas, botones antiguos ausentes; escritorio 1280×1800 y móvil 390×844 sin desbordamiento ni errores JavaScript. Cuenta sin avisos: borrado y confirmación con datos reales pendientes; no se fabricaron notificaciones ni se borraron datos reales.
- Configuración existente: claves pública/privada presentes, flag de envío activo; cron `nexo-web-push-delivery` activo cada minuto a `/api/public/jobs/push`. No se alteraron cron, claves, worker, miniaturas ni enlaces. Esto comprueba configuración, no recepción. Cola histórica: 1 sent y 140 failed; estos fallos previos no se reintentaron ni se atribuyeron a una causa sin evidencia.
- Sin publicación/despliegue, dominios, pagos ni módulos ajenos. No se enviaron pruebas a usuarios. Recepción real con NEXO cerrado, permiso nativo de teléfono y comportamiento del SO siguen pendientes de un dispositivo compatible real.

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

Sin despliegue ni aplicación de la migración 0039 en la base alojada; no se alteraron claves, cron, métodos de pago ni servicios externos.

## Ampliación de categorías y filtros por subasta
- Migración 0039 incorpora jerarquía padre/subcategoría, descripciones, icono, orden y estado activo; conserva los IDs existentes para no alterar publicaciones previas.
- Amplía la clasificación inicial a vehículos/transporte/maquinaria, inmuebles/construcción, hogar, tecnología, moda, agricultura, industria, arte, deportes, salud, educación, negocios, activos digitales y servicios profesionales/personales.
- Administración dispone de una pestaña Categorías para crear, editar, ordenar y activar/desactivar. No borra categorías utilizadas ni cambia sus identificadores; el slug queda fijo al editar.
- Los usuarios pueden elegir categorías y subcategorías para nuevas subastas; una selección vacía representa todas las categorías, incluidas las que se añadan después.
- El disparador de nuevas subastas y la cola de entrega vuelven a comprobar las preferencias por categoría, además del consentimiento general.
- El permiso nativo del navegador sigue siendo opcional y se solicita solo desde la acción contextual del usuario. La sincronización pasiva no abre el diálogo ni repite solicitudes.
- No se activaron claves, cron, envíos de prueba ni entregas reales. La recepción en dispositivo cerrado requiere una prueba manual autorizada con un dispositivo compatible y permiso nativo concedido.
