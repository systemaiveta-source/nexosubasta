# NEXO — Plan de actualización integral (sin publicar)

## Estado actual encontrado (análisis)
- **Módulo 1 (operaciones):** ya implementado en la migración 0038: publicar sin métodos de pago, aceptación independiente de comprador y vendedor, "Marcar como completado" por cada parte, cierre solo con ambas, disputa bloquea el cierre, chat y adjuntos privados por permisos de base de datos. Falta: estados con nombres claros (los 8 pedidos) derivados en servidor y avisos en cada aceptación/confirmación.
- **Módulo 2 (push):** existe Web Push nativo propio (worker `nexo-push-sw.js`, cola con reintentos, deduplicación, miniatura vía `image`, icono NEXO). Firebase queda como legado sin uso. Unos 18 eventos ya generan avisos; faltan algunos (subasta próxima a finalizar, aceptaciones, recordatorios).
- **Módulos 3–5 (categorías):** hoy hay una lista plana de categorías y solo los servicios tienen campos específicos. No existen subcategorías, atributos dinámicos ni panel administrativo.

## Fase A — Operaciones (pequeña)
- Función compartida que deriva el estado visible: Pendiente de aceptación / Esperando comprador / Esperando vendedor / Coordinando pago y entrega / Esperando confirmación de una parte / Completada / En disputa o cancelada. Se calcula desde datos del servidor, nunca desde el navegador.
- Mostrar quién confirmó y quién falta en la operación y en el listado.
- Pruebas unitarias para cada estado.

## Fase B — Avisos push
- Añadir avisos (en la base de datos, sin duplicar) para: aceptación del comprador, aceptación del vendedor, confirmación de una parte, operación completada, nueva conversación al adjudicar (si falta), recordatorio de operación pendiente (una vez cada 24 h como máximo, reutilizando el proceso periódico existente sin cambiar su horario) y "subasta próxima a finalizar" (una sola vez por subasta y participante, solo cuando ya corre la cuenta regresiva).
- Worker: no marcar `silent`, usar `renotify` por conversación, vibración estándar; el sonido será el **predeterminado de Android/Chrome**. La Web no permite elegir un sonido propio; canales con sonido personalizado requerirían una app Android nativa (fuera de alcance).
- Pruebas automáticas del contenido del aviso con y sin imagen y del enlace al tocar.
- **Límite honesto:** puedo demostrar "guardado en base de datos" y "aceptado por el servicio de envío". "Entregado" y "visible en el teléfono" solo puede confirmarlo alguien con el Android en la mano; no haré envíos reales sin tu autorización.

## Fase C — Categorías inteligentes (la parte grande)
- Nuevas tablas aditivas: subcategorías y atributos (nombre, tipo: texto/número/fecha/lista/sí-no, unidad, obligatorio, orden, activo), asociados a categoría o subcategoría. Valores guardados por subasta en una columna nueva opcional; las publicaciones antiguas siguen funcionando sin atributos.
- Datos iniciales: las 19 categorías con sus subcategorías y fichas (aeronáutica, náutica, vehículos, tecnología, hogar, agricultura, etc. según tu lista) y "Estado del artículo": nuevo/usado/reacondicionado/para reparación. Las categorías actuales se conservan y se enlazan, sin borrar ninguna.
- Validación en el servidor al publicar (obligatorios y tipos), no solo en el formulario.
- Formulario de publicación: subcategoría dependiente y campos que cambian según la selección (sin kilometraje para computadoras, etc.). Nada se completa automáticamente.

## Fase D — Ficha para compradores
- Sección "Características declaradas por el vendedor" con categoría, subcategoría, estado y atributos agrupados; los vacíos no se muestran. Sin etiquetas de "verificado/certificado". Adaptada a móvil y laptop.

## Fase E — Panel administrativo de categorías
- Nueva pestaña en el panel de administración: crear/editar categorías, subcategorías y atributos, cambiar orden, activar/desactivar. Un atributo con publicaciones asociadas solo se desactiva, nunca se borra. Solo administradores, comprobado en la base de datos.

## Fuera de alcance (sin cambios)
Motor de subastas, pujas, temporizadores, extensiones, membresías, comisiones, pagos de NEXO, dominio, secretos, proveedores de envío.

## Créditos y orden recomendado
El último saldo visto era muy bajo (0,40). Este paquete completo requiere varias sesiones. Propongo ejecutar en orden **A → B → C+D → E**, deteniéndome y reportando si se agotan los créditos. Cada fase deja pruebas, informe de archivos y migraciones.

## Detalles técnicos
- Migraciones nuevas 0039+ (solo aditivas): `category_subcategories`, `category_attributes`, `auctions.subcategory_id`, `auctions.attributes jsonb default '{}'`, `auctions.item_condition`; GRANT + RLS (lectura pública de activos, escritura vía RPC con `has_role admin`).
- `auctions_safe` se amplía para exponer subcategoría/atributos/estado (sin datos privados).
- Validación de atributos dentro de `save_auction_draft`/`publish_auction` mediante función auxiliar, sin tocar la lógica de reloj.
- Avisos nuevos con `event_kind` propios y clave de deduplicación.
