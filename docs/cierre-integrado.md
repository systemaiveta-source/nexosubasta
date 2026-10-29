# Cierre integrado NEXO — 29 octubre 2026

## Cambios aplicados
- Migraciones 0005–0010: presupuesto de servicio privado, proyección pública segura, historial de pujas restringido a propietario/postor/admin, selección final del proveedor, operación única, chat idempotente, adjuntos privados, historial de estados, confirmaciones propias y bloqueo de finalización prematura/disputa.
- `place_bid`: bloqueo de idempotencia antes de insertar, rechazo de reutilización para otra oferta, validación de importe y extensión exactamente +60 segundos cuando quedan ≤60 segundos. Servicios admiten primera oferta sin precio inicial público y posteriores ofertas descendentes. El presupuesto no se usa en mensajes de error ni como precio público.
- `process_auctions`: productos conservan adjudicación única; servicios terminan pendientes de elección del cliente, sin adjudicar automáticamente. El programador existente `nexo-process-auctions` está activo cada minuto; no fue creado ni cambiado en esta intervención. Su ejecución efectiva sin usuarios conectados no fue probada.
- `save_auction_draft`, `new_auction_draft`, `my_auction_draft`, `publish_auction`: guardado atómico, editar/reabrir, inicio programado y límite del plan bajo bloqueo por propietario; membresía/estado/propiedad comprobados en servidor.
- Métodos de pago declarados para subastas, separados de membresías: selección múltiple, búsqueda, Otro con nombre, cripto con activo/red. Snapshot por puja y restricción diferida contra saltarse aceptación. El catálogo genérico actual está en código, no es todavía un catálogo global editable por administración.
- Mis ofertas deja de ser un placeholder. Operaciones tiene lista y detalle privado independiente, mensajes con actualización cada cinco segundos, archivo privado, acuerdo de método, etapas, disputa y completar por cada parte.
- Países/territorios: 249 códigos ISO 3166-1, etiquetas españolas CLDR. Monedas: 162 códigos ISO/CLDR disponibles, sin tipos de cambio ni conversión. Selector en publicación/perfil y catálogo.
- Terminología Subastar/Subastador/Cliente/Proveedor y acceso real al catálogo desde inicio. NFT no se implementó; categoría existente oculta y bloqueada en nuevos borradores/publicación. No se eliminaron datos existentes.

## Archivos/módulos
- SQL: `drizzle/migrations/0005_secure_services_operations.sql` hasta `0010_completion_stage_guard.sql`; tipos regenerados por la herramienta.
- Nuevos: `src/lib/operations.ts`, `operations.functions.ts`, `operations.test.ts`, `bids.functions.ts`, `auction-payments.ts`, `auction-payments.test.ts`, `currency.test.ts`, `src/components/AuctionPaymentMethods.tsx`, `src/routes/_authenticated/operaciones.$id.tsx`.
- Lista de operaciones movida a `operaciones.index.tsx` para no ocultar el detalle. Modificados: panel, vendedor, perfil, admin (lectura segura), catálogo, detalle, AuctionCard, currency, destinations y sus pruebas, format, inicio, AGENTS y roadmap.

## Pruebas realmente ejecutadas
- `bunx vitest run`: 8 archivos, **34 pruebas aprobadas**, 0 fallidas. Incluye confirmación independiente, disputa, receptor de pago, bloqueo antes de entrega; Otro/activo/red; ISO; destinos exactos; regresiones de pagos existentes.
- ESLint dirigido a 22 archivos modificados: **0 errores, 1 advertencia** Fast Refresh existente en AuctionCard. No equivale a lint de todo el proyecto.
- Compilación/typecheck automática del entorno: último registro **build OK** a las 22:09:44 UTC; no se ejecutó un build manual porque el entorno exige usar su comprobación automática. Errores intermedios de regexp, campos opcionales y nulabilidad de vistas fueron corregidos.
- Navegador con sesión real autorizada del solicitante: catálogo con dos subastas reales; detalle/foto/importe/reserva alcanzada; Mis ofertas sin placeholder; Operaciones sin registros; cuenta sin permiso de subastador mantiene activación visible, no se pulsó para cambiar roles. URL exacta de operación inexistente muestra denegación segura y regreso a operaciones. Sin errores JavaScript observados.
- Escritorio 1280×1800; móvil 390×844: operaciones sin desbordamiento, capturas revisadas. No equivale a probar todas las pantallas en ambos tamaños.
- Respuestas reales: lectura anónima de legacy starting_price de servicio denegada (HTTP 401); proyección segura de servicios HTTP 200; historial anónimo de pujas denegado (HTTP 401); lectura privada con solicitante sin propiedad devolvió 0 filas. No se imprimieron tokens ni datos de usuarios.
- Manifest HTTP 200, iconos existentes 192×192/512×512/maskable 512×512, sin service workers registrados en preview. No se probó instalación efectiva en teléfono.

## Fallos, límites y bloqueos exactos
- Prueba SQL reversiblemente autenticada no ejecutable: rol sandbox_exec carece de USAGE en esquema auth y EXECUTE en process_auctions. No se concedieron permisos ni se evitó este límite.
- La cuenta autorizada es participante, sin operaciones ni membresía subastadora. No se probó publicación, pujas válidas/concurrentes, extensión temporal, cierre offline, selección de proveedor, mensaje/archivo real, pago, disputa o confirmaciones entre dos cuentas. Las pruebas unitarias y lectura de definición no sustituyen ese ciclo.
- Administración/pagos: sigue requiriendo sesión admin autorizada para guardar/reabrir, activar/desactivar, historial y aprobación única; no se activaron ni editaron métodos reales. Corrección anterior de ambigüedad `f` conservada.
- Presupuesto privado nuevo: no se copiaron ni cambiaron precios históricos de servicios; legado se suprime públicamente, pero el nuevo presupuesto solo existe para guardados nuevos/corregidos por propietario. No se reasignaron operaciones históricas automáticamente.
- Push: no se configuró proveedor ni claves; no se anuncia como operativo. Se conservó instalación manifest-only según la habilidad PWA; no se añadió caché offline ni worker ficticio. Correo/recuperación/verificación alojados y backups no verificados.
- Faltan catálogos administrativos globales/subcategorías/formularios especializados, preferencias y eventos completos de notificaciones, recomendaciones IA/moderación, reputación y auditoría integral de estados históricos. Historial/chat tiene límites de 100 operaciones/200 mensajes; paginación más profunda pendiente.
- La primera oferta de servicio no usa el presupuesto privado como límite: evita revelar el límite mediante un error; el cliente evalúa importe/condiciones y decide. Las ofertas válidas siguen siendo descendentes.

## Publicación y servicios externos
No hubo publicación, despliegue, cambio de dominio, compra, contratación, activación de pagos o proveedor externo; ningún rol fue otorgado y ningún usuario/método real fue modificado para probar. Los cambios compatibles de base de datos se aplicaron al backend compartido del proyecto existente, como autorizó el usuario, sin desplegar la actualización de código.