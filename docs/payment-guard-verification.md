# NEXO: verificación del bloqueo de métodos de pago

Fecha: 2026-10-29. Proyecto existente; sin publicación ni servicios externos activados.

## Causa y corrección aplicada

La función activa `public.manual_method_guard()` declaraba `f jsonb` y también usaba `f` como alias de `jsonb_array_elements`. Al guardar `details.requirements`, PostgreSQL rechazó la expresión `f->>'required'` con SQLSTATE 42702, `column reference "f" is ambiguous`.

La migración `0004_fix_manual_method_guard_ambiguous_reference.sql` cambia la variable a `requirement_value` y califica las columnas como `requirement_row.value`, `required_row.value`, `request_row.payment_method_id` y `stored_file.*`. No cambia los requisitos obligatorios, límites, comprobación de QR ni protección del historial. Se comprobó la definición aplicada mediante una lectura del catálogo de funciones.

## Pruebas realmente ejecutadas

- Reproducción antes de la corrección: intentar guardar un requisito obligatorio en un método existente inactivo produjo 42702; la escritura falló sin modificar el método.
- Después: se creó un método temporal explícitamente marcado como prueba, inactivo y sin datos bancarios reales; se editaron nombre, instrucciones, moneda y requisitos obligatorios/opcionales. Una lectura independiente devolvió los valores editados.
- Guardar requisitos todos opcionales fue rechazado con `Exige un comprobante obligatorio` (P0001).
- El método temporal sin referencias se eliminó correctamente. Los métodos existentes no fueron activados ni cambiados por estas pruebas.
- Navegador con sesión real del solicitante, rol participante: `/admin` mostró denegación. INSERT directo de un método devolvió 42501; UPDATE y DELETE de un método existente no afectaron filas. Lectura pública de métodos permitida conforme al diseño actual.
- `bunx vitest run`: 4 archivos, 18 pruebas aprobadas, incluidas dos nuevas pruebas de persistencia de campos configurados y requisito obligatorio. Estas pruebas unitarias no sustituyen el recorrido administrativo en navegador.
- ESLint en `PaymentMethodsAdmin.tsx`, `ManualMembershipCheckout.tsx`, `manual-payments.ts`, `manual-payments.test.ts` y `manual-payments.functions.ts`: salida 0, sin errores, después de formatear esos archivos. No se afirma que el lint de todo el proyecto pase.
- Registro automático de vista previa: `build OK` después de las correcciones de tipos.

## Bloqueo y límites

La cuenta solicitante no tiene rol administrador. La herramienta rechazó crear una sesión para la cuenta administradora porque necesita una autorización que no está disponible en este contexto. No se otorgaron roles ni se evitaron controles para probar.

Pendiente: guardar/reabrir desde el formulario administrativo autenticado, activación/desactivación, borrado con historial, pagos duplicados, aprobación única, cargas privadas y ciclo completo de membresía con dos cuentas autorizadas. No se activaron métodos para facilitar pruebas.

La auditoría encontró además flujos aún incompletos: Mis ofertas y Operaciones siguen siendo pantallas pendientes; servicios mantienen el motor de adjudicación automática anterior y el presupuesto público como precio inicial, incompatibles con el nuevo requerimiento; catálogos internacionales, notificaciones con destinos exactos y push requieren trabajo posterior. No se implementaron ni se presentaron como completos en esta corrección.

No se verificaron configuración alojada de correo/push, funcionamiento offline, cierre programado en producción, respaldo/recuperación ni pruebas concurrentes. No se contrató ningún servicio ni hubo despliegue.