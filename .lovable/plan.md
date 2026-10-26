# NEXO — Plan de construcción

Plataforma de subastas y marketplace, instalable como app (PWA), construida por fases. Tu brief pide aprobación antes de construir, así que este plan es la Fase 1.

## Identidad visual
- Uso tu archivo del logotipo tal cual (N roja, E azul, X amarilla, O verde), sin redibujar ni pasarlo por IA.
- Favicon e iconos de la app: se recortan y escalan desde ese mismo archivo, con relleno sin estirar. Como el logo es horizontal, en el icono cuadrado pequeño se verá reducido; si tienes una versión cuadrada (por ejemplo solo la "N" o un monograma aprobado), envíamela.
- Interfaz: fondo blanco/neutro, tipografía legible y los cuatro colores como acentos (estados, etiquetas, botones).

## Fases (cada una es un turno de trabajo acotado, con pruebas)
1. **Base + marca + PWA**: estructura, sistema de diseño, página de inicio, normas/privacidad/ayuda, página de instalación con instrucciones por sistema (Android, iPhone/iPad, Windows, macOS, Linux), manifiesto e iconos. Sin modo sin conexión todavía.
2. **Cuentas y permisos**: registro, inicio de sesión (correo + Google), recuperación de contraseña, perfiles, roles (comprador, vendedor, moderador, administrador) guardados en una tabla aparte y verificados en el servidor.
3. **Motor de subastas**: ofertas validadas en el servidor de forma atómica, incremento mínimo configurable, anti-duplicado, extensión exacta de 60 s registrada, cierre automático programado aunque nadie esté conectado, un solo ganador. Precio esperado y reserva nunca salen del servidor; el público solo ve "Reserva alcanzada / aún no alcanzada". Pruebas con el ejemplo 100 / 300 / 250 (230 = sin venta, 275 = venta).
4. **Catálogo y paneles**: búsqueda, categorías, filtros, página de subasta en tiempo real, borradores y publicación con fotos, panel de comprador y vendedor.
5. **Suscripciones**: planes configurables y estados; cobros desactivados o en modo de prueba hasta que autorices un proveedor.
6. **Operaciones privadas**: chat comprador-vendedor tras la adjudicación, confirmaciones, disputas, reputación (solo tras operación real).
7. **Administración, notificaciones y supervisión con IA** (la IA solo alerta; nunca decide ganadores ni toca ofertas).
8. **Pruebas** de seguridad, concurrencia, PWA y multidispositivo; modo sin conexión con service worker (solo en la app publicada, nunca en la vista previa).
9. **Documentación y lanzamiento controlado.**

## Servicios y costes
- **Lovable Cloud** (base de datos, cuentas, archivos, tareas programadas): incluido con uso gratuito; el consumo alto puede generar coste en tu saldo de Lovable.
- **IA de Lovable** (Fase 7): consume créditos según uso.
- **Pagos** (Fase 5): no se activa nada sin tu autorización; el proveedor cobra sus propias comisiones.
- **Dominio propio**: opcional, pago aparte. No publicaré sin tu permiso.

## Limitaciones honestas
- Ningún sitio puede instalarse solo y en silencio; uso el aviso oficial del navegador cuando existe e instrucciones guiadas cuando no (iPhone/iPad).
- Las notificaciones push en iPhone solo funcionan con la app añadida a la pantalla de inicio.
- No afirmaré pruebas en un sistema o navegador que no haya probado de verdad.
- El nombre "NEXO" y el dominio deben verificarse legalmente antes del lanzamiento comercial.

## Pendiente de tu parte (no bloquea la Fase 1)
- Precios de planes, incremento mínimo, duraciones y reglas de cancelación.
- Versión cuadrada del logo para el icono, si existe.

## Detalles técnicos
- TanStack Start + Lovable Cloud (Postgres con RLS). Ofertas mediante función SQL `place_bid` con bloqueo de fila (`SELECT ... FOR UPDATE`), clave de idempotencia única y hora del servidor; extensiones en tabla `auction_extensions`.
- Precio esperado y reserva en tabla privada sin acceso público; vista pública expone solo `reserve_met boolean`.
- Cierre con `pg_cron` llamando a una función SQL de cierre idempotente.
- Tiempo real con suscripciones de Postgres sobre la vista pública.
- Logo como asset desde el archivo subido; iconos generados con ImageMagick (resize + padding, sin deformar).
- Pruebas automatizadas del motor (vitest + SQL) incluidas en el proyecto.
