# Mejoras acotadas de NEXO

Sin publicar ni desplegar; sin cambiar pagos, membresías, reglas de subasta, dominio, secretos, cron ni proveedores. No se borrarán registros reales durante las pruebas.

## Cambios

1. **Mi perfil:** destacar accesos a Mis publicaciones, Mis compras y Mis ventas. Agrupar datos, membresía, referidos y saldo en secciones desplegables y cargar información secundaria al abrirlas, conservando sus funciones.
2. **Publicaciones:** mostrar activas/próximas y borradores editables; separar «Finalizadas sin ofertas / Pendientes de renovar». Ofrecer Renovar, Publicar de nuevo y Eliminar con confirmación. Renovar abre un nuevo borrador; Publicar de nuevo prepara una nueva publicación y solicita confirmación antes de publicarla. Ambas usan un nuevo ID y fechas nuevas, respetando los límites y validaciones actuales. El historial adjudicado continúa público sin datos privados de la operación.
3. **Catálogo:** sustituir los controles de páginas por carga incremental de 24 resultados al acercarse al final. Conservar filtros, búsqueda y orden; deduplicar por ID y mostrar carga, reintento y fin de lista.
4. **Operación/chat:** accesos directos desde compras/ventas y publicaciones adjudicadas propias. Añadir encabezado compacto con imagen, título, monto final, referencia, rol y contraparte. Mostrar el chat primero en móvil, sin eliminar controles de pago, entrega, disputas o reputación.
5. **Push Android:** mantener Web Push nativo y el worker exclusivo de mensajería, sin incorporar Firebase al flujo actual. Comprobar compatibilidad del contenido enviado, icono/badge NEXO, miniatura pública y apertura directa. Corregir únicamente fallos reproducibles.

## Seguridad y conservación

- La eliminación existente borra físicamente una vencida sin ofertas y puede borrar registros asociados por cascada. Se ajustará para retirar esa publicación de la interfaz conservando el registro y sus evidencias, exclusivamente mediante una acción confirmada de su propietario; no se ejecutará sobre publicaciones reales en la validación.
- Revisar la función de republicación para conservar términos y crear fechas nuevas sin alterar el registro original ni copiar pujas, participantes o comprobantes.
- Operaciones y chat conservarán RLS y RPC; añadir comprobación explícita de las partes en las lecturas del servidor, sin ampliar permisos.
- Cualquier cambio que exija transformar o borrar datos persistentes existentes se detendrá para solicitar aprobación detallada.

## Detalles técnicos

- `useInfiniteQuery`, orden con desempate por ID y observador de fin de lista; sin consultas de todos los resultados ni conteo total obligatorio.
- Reutilizar la consulta autenticada de publicaciones y operaciones. Los enlaces públicos nunca incluirán identificadores de operación ajena.
- Migración aditiva solo si se necesita marcar publicaciones retiradas; mantener `auctions_safe` como frontera segura y los históricos intactos.
- Validar activación del worker correcto y errores de apertura; no cambiar suscripciones, cron ni configuración externa de forma indiscriminada.

## Validación y entrega

- Pruebas dirigidas de lotes/deduplicación, republicación sin mutación, eliminación aislada y conservación de evidencias, y acceso al chat por propietario/contraparte/no participante.
- Pruebas del worker con imagen, sin imagen y clic a subasta/operación, incluyendo destino externo rechazado.
- Ejecutar la suite disponible y revisar los resultados automáticos de tipos/compilación. Comprobar catálogo y perfil en escritorio y móvil con una sesión autorizada disponible; no crear pujas, pagos, mensajes ni calificaciones reales para probar.
- Entregar relación exacta de archivos/migraciones, pruebas y limitaciones. La aceptación del servidor no se presentará como recepción en Android: la recepción con PWA cerrada requiere observación en un dispositivo real autorizado, y Android controla parte de la presentación.