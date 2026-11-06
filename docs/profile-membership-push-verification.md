# Perfil, beneficios y avisos · 6 noviembre 2026

## Cambios
- Perfil público terminado: nombre, ubicación pública, biografía, insignia, reputación y publicaciones; sin teléfono, código de referidos ni fechas de suscripción.
- Publicaciones propias: RPC autenticada y filtrada por propietario, basada en auctions_safe; incluye borradores y estados privados de gestión sin exponer precios privados. Perfil y editor muestran errores en vez de listas vacías engañosas.
- Beneficios estructurados por plan y suscripción efectiva: publicidad mensual/semanal de 24 horas, permanente para Élite, insignias Pro/Élite. Ventanas ancladas a inicio de suscripción. Catálogo con sección destacada independiente de la página ordinaria.
- Soporte privado en perfil y administración, solicitudes prioritarias ordenadas primero según la membresía; respuesta autorizada en DB y aviso interno/push existente. No promete un tiempo de respuesta ni sustituye la atención humana.
- Referidos futuros ya no figuran como activos antes de su fecha de inicio. Límites de publicación y comisiones existentes no se modificaron.
- Push: reintentos transitorios limitados a tres, recuperación de reclamaciones antiguas, timeout, diagnóstico por etapa sin credenciales, miniaturas públicas para chat de productos y orígenes oficiales validados. Permiso contextual también en perfil/ofertas/editor; sigue siendo único y requiere gesto.

## Migraciones aplicadas
- 0031_profile_membership_benefits_and_push_recovery.sql
- 0032_owner_publication_projection.sql
- 0033_membership_calendar_windows_and_public_badges.sql
- 0034_membership_support_requests.sql
- 0035_private_membership_entitlement_reads.sql

## Archivos
- Nuevos: profiles.functions.ts, support.functions.ts, MembershipSupport.tsx, push-delivery.ts, membership-benefits.sql.test.ts, push-worker.test.ts.
- Modificados: usuarios.$id.tsx, _authenticated/perfil.tsx, _authenticated/vendedor.tsx, _authenticated/admin.tsx, subastas.index.tsx, SiteLayout.tsx, AuctionCard.tsx, PushLifecycle.tsx, web-push.server.ts, notifications.sql.test.ts y public/nexo-push-sw.js; AGENTS.md, roadmap.md y este informe.

## Evidencia
- Suite: 139/139 pruebas, 23 archivos. Incluye DB PostgreSQL desechable: privacidad, borradores propios, aislamiento soporte, fechas de membresía, ventanas de 24 horas, recuperación de cola y miniaturas de chat.
- Comprobaciones automáticas de tipos y compilación: última entrada build OK.
- Navegación real anónima: perfil existente y sus publicaciones cargan; catálogo muestra destacadas; 360×559 sin desbordamiento; sin errores de ejecución. Miniatura de producto real HTTP 200 image/jpeg.
- Perfil privado sin sesión redirige a autenticación. No se obtuvo sesión del solicitante: no existe coincidencia de cuenta con su identidad de la plataforma. No se eligió otra cuenta ni se crearon datos artificiales.
- Cifrado del payload con configuración actual aprobado sin enviar a ningún dispositivo.
- Cron de envío existente activo cada minuto, intacto. Claves presentes, no modificadas. Cola real: 1 enviado, 148 fallidos (140 antiguos sin motivo y 8 recientes con send error). No se reactivaron fallos históricos ni se dispararon envíos de prueba.

## Límites y pendientes
- LG K22 informado; recepción con app cerrada y visualización de imagen no probadas en ese teléfono. Android/Chrome necesita primera visita, inicio de sesión, permiso concedido y registro del dispositivo; no se puede enviar a quien nunca abrió NEXO ni aceptó avisos. La imagen depende del navegador/SO y puede requerir expandir el aviso. Ahorro de batería, navegador detenido o red pueden retrasarlo.
- Los 8 fallos recientes no permiten atribuir causa concreta. El nuevo diagnóstico distingue payload/network/record; no se afirma entrega física ni reparación demostrada de esos fallos.
- Lectura de publicaciones personales y envío/respuesta real de soporte pendientes de sesión autorizada. Atención prioritaria necesita personal que responda; el sistema ordena la cola, no inventa atención humana.
- Cambios de aplicación y worker únicamente en vista previa hasta publicación autorizada. Migraciones sí aplicadas en Cloud compartida. No se publicó/desplegó, cambió DNS, cron, secretos, cobros ni activó membresías.