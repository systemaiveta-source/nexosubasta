import { z } from "zod";
export type ServiceField = {
  key: string;
  label: string;
  type?: "text" | "textarea" | "date" | "datetime-local" | "number" | "select";
  options?: string[];
  required?: boolean;
  when?: [string, string];
};
export type ServiceCategory = {
  id: string;
  name: string;
  subcategories: string[];
  fields: ServiceField[];
};
const field = (
  key: string,
  label: string,
  type: ServiceField["type"] = "text",
  required = true,
): ServiceField => ({ key, label, type, required });
const choice = (key: string, label: string, options: string[]): ServiceField => ({
  key,
  label,
  type: "select",
  options,
  required: true,
});
const location = field("location", "Dirección completa y referencias del servicio");
const deadline = field("deadline", "Fecha límite", "date");
const professional = [
  field("specialty", "Especialidad requerida"),
  field("scope", "Alcance del trabajo", "textarea"),
  field("deliverables", "Entregables", "textarea"),
  choice("mode", "Modalidad", ["Remota", "Presencial"]),
  { ...location, when: ["mode", "Presencial"] as [string, string] },
  deadline,
  field("requirements", "Requisitos y documentación", "textarea"),
];
export const SERVICE_CATALOG: ServiceCategory[] = [
  {
    id: "transport",
    name: "Transporte y acarreo",
    subcategories: [
      "Mudanzas",
      "Acarreo",
      "Carga comercial",
      "Transporte de personas",
      "Mensajería",
    ],
    fields: [
      field("origin", "Dirección exacta de recogida"),
      field("origin_reference", "Referencias de recogida"),
      field("destination", "Dirección exacta de entrega"),
      field("destination_reference", "Referencias de entrega"),
      field("datetime", "Fecha y hora", "datetime-local"),
      field("cargo", "Carga, objetos o pasajeros", "textarea"),
      field("dimensions", "Peso, dimensiones y cantidad"),
      field("access", "Acceso, pisos y ayuda para carga"),
      field("contact", "Contacto e instrucciones privadas"),
    ],
  },
  {
    id: "mechanics",
    name: "Mecánica",
    subcategories: ["Diagnóstico", "Reparación", "Mantenimiento", "Asistencia en carretera"],
    fields: [
      field("brand", "Marca"),
      field("model", "Modelo"),
      field("year", "Año", "number"),
      choice("vehicle", "Tipo de vehículo", [
        "Automóvil",
        "Motocicleta",
        "Camión",
        "Maquinaria",
        "Otro",
      ]),
      field("problem", "Problema y síntomas", "textarea"),
      choice("attendance", "Atención", ["En taller", "Visita al lugar", "Asistencia en carretera"]),
      { ...location, when: ["attendance", "Visita al lugar"] },
      {
        ...field("road_location", "Ubicación exacta en carretera"),
        when: ["attendance", "Asistencia en carretera"],
      },
      {
        ...field("road_contact", "Contacto e instrucciones de asistencia"),
        when: ["attendance", "Asistencia en carretera"],
      },
      deadline,
    ],
  },
  {
    id: "plumbing",
    name: "Plomería",
    subcategories: ["Fugas", "Desagües", "Instalaciones sanitarias", "Bombas y tanques"],
    fields: [
      choice("problem_type", "Problema", [
        "Fuga",
        "Obstrucción",
        "Instalación",
        "Bomba o tanque",
        "Otro",
      ]),
      location,
      choice("urgency", "Urgencia", ["Inmediata", "Hoy", "Programada"]),
      field("problem", "Descripción y zonas afectadas", "textarea"),
      choice("visit", "Requiere visita", ["Sí", "No"]),
      field("materials", "Materiales y acceso disponibles", "textarea", false),
      deadline,
    ],
  },
  {
    id: "electrical",
    name: "Electricidad",
    subcategories: ["Instalaciones", "Reparaciones", "Iluminación", "Paneles y protección"],
    fields: [
      choice("problem_type", "Problema", [
        "Sin energía",
        "Cortocircuito",
        "Instalación",
        "Iluminación",
        "Otro",
      ]),
      location,
      choice("urgency", "Urgencia", ["Inmediata", "Hoy", "Programada"]),
      field("problem", "Síntomas y circuitos afectados", "textarea"),
      field("voltage", "Voltaje y tipo de instalación"),
      choice("visit", "Requiere visita", ["Sí", "No"]),
      deadline,
    ],
  },
  {
    id: "accounting",
    name: "Contabilidad",
    subcategories: [
      "Impuestos",
      "Nómina",
      "Estados financieros",
      "Auditoría",
      "Contabilidad mensual",
    ],
    fields: [
      ...professional,
      field("jurisdiction", "País y régimen fiscal"),
      field("period", "Periodo contable"),
      field("volume", "Cantidad de documentos o transacciones"),
    ],
  },
  {
    id: "professional",
    name: "Servicios profesionales",
    subcategories: ["Consultoría", "Legal", "Ingeniería", "Administración", "Traducción"],
    fields: professional,
  },
  {
    id: "home",
    name: "Hogar y limpieza",
    subcategories: ["Limpieza", "Jardinería", "Pintura", "Reparaciones"],
    fields: [
      location,
      field("area", "Área, habitaciones o superficie"),
      field("tasks", "Tareas solicitadas", "textarea"),
      choice("frequency", "Frecuencia", ["Una vez", "Semanal", "Mensual"]),
      field("supplies", "Materiales y equipos disponibles"),
      deadline,
    ],
  },
  {
    id: "construction",
    name: "Construcción",
    subcategories: ["Albañilería", "Remodelación", "Techos", "Carpintería"],
    fields: [
      location,
      field("work", "Obra requerida", "textarea"),
      field("measurements", "Medidas y superficie"),
      field("materials", "Materiales, planos y permisos"),
      deadline,
    ],
  },
  {
    id: "technology",
    name: "Tecnología",
    subcategories: ["Soporte técnico", "Desarrollo web", "Redes", "Reparación de equipos"],
    fields: [
      field("system", "Equipo, plataforma o sistema"),
      field("problem", "Problema u objetivo", "textarea"),
      field("deliverables", "Resultado requerido", "textarea"),
      choice("mode", "Modalidad", ["Remota", "Presencial"]),
      { ...location, when: ["mode", "Presencial"] },
      deadline,
    ],
  },
  {
    id: "design",
    name: "Diseño y comunicación",
    subcategories: ["Diseño gráfico", "Fotografía", "Marketing", "Contenido"],
    fields: [
      field("brief", "Objetivo y audiencia", "textarea"),
      field("formats", "Formatos y piezas"),
      field("references", "Referencias y estilo"),
      field("revisions", "Revisiones requeridas", "number"),
      deadline,
    ],
  },
  {
    id: "events",
    name: "Eventos",
    subcategories: ["Catering", "Sonido", "Decoración", "Organización"],
    fields: [
      field("event", "Tipo de evento"),
      location,
      field("datetime", "Fecha y hora", "datetime-local"),
      field("guests", "Número de asistentes", "number"),
      field("equipment", "Equipamiento y servicios requeridos", "textarea"),
    ],
  },
  {
    id: "tourism",
    name: "Turismo",
    subcategories: ["Guías", "Excursiones", "Planificación de viajes"],
    fields: [
      field("destination", "Destino e itinerario"),
      field("date", "Fecha", "date"),
      field("travelers", "Número de viajeros", "number"),
      field("language", "Idioma"),
      field("accessibility", "Accesibilidad y necesidades", "textarea"),
    ],
  },
  {
    id: "agriculture",
    name: "Agricultura",
    subcategories: ["Cultivos", "Riego", "Maquinaria", "Asesoría agrícola"],
    fields: [
      location,
      field("crop", "Cultivo o actividad"),
      field("area", "Superficie"),
      field("work", "Trabajo y equipo requerido", "textarea"),
      deadline,
    ],
  },
  {
    id: "pets",
    name: "Mascotas",
    subcategories: ["Cuidado", "Paseos", "Peluquería", "Entrenamiento"],
    fields: [
      field("animal", "Especie, raza y edad"),
      field("care", "Servicio y necesidades", "textarea"),
      location,
      field("datetime", "Fecha y hora", "datetime-local"),
      field("behavior", "Comportamiento y precauciones", "textarea"),
    ],
  },
  {
    id: "health",
    name: "Salud y bienestar",
    subcategories: ["Acompañamiento", "Bienestar", "Fisioterapia", "Cuidado domiciliario"],
    fields: [
      field("service", "Servicio requerido (sin datos clínicos públicos)"),
      field("qualification", "Acreditación profesional requerida"),
      choice("mode", "Modalidad", ["Remota", "Presencial"]),
      { ...location, when: ["mode", "Presencial"] },
      deadline,
      field("requirements", "Requisitos privados", "textarea"),
    ],
  },
  {
    id: "business",
    name: "Servicios empresariales",
    subcategories: ["Logística", "Capacitación", "Recursos humanos", "Procesos"],
    fields: [
      field("sector", "Sector empresarial"),
      field("scope", "Proceso y alcance", "textarea"),
      field("deliverables", "Entregables y métricas", "textarea"),
      field("team", "Número de personas", "number"),
      deadline,
    ],
  },
  {
    id: "other",
    name: "Otros",
    subcategories: ["Servicio personalizado"],
    fields: [
      field("custom_category", "Describe la categoría"),
      field("scope", "Trabajo solicitado", "textarea"),
      field("deliverables", "Resultado requerido", "textarea"),
      choice("mode", "Modalidad", ["Remota", "Presencial"]),
      { ...location, when: ["mode", "Presencial"] },
      deadline,
    ],
  },
];
export const serviceRequestSchema = z
  .object({ category: z.string(), subcategory: z.string(), values: z.record(z.string().max(2000)) })
  .superRefine((data, context) => {
    const category = SERVICE_CATALOG.find((entry) => entry.id === data.category);
    if (!category || !category.subcategories.includes(data.subcategory)) {
      context.addIssue({ code: "custom", message: "Elige categoría y subcategoría válidas" });
      return;
    }
    for (const item of category.fields) {
      if (item.when && data.values[item.when[0]] !== item.when[1]) continue;
      const value = data.values[item.key]?.trim() ?? "";
      if (item.required && !value)
        context.addIssue({
          code: "custom",
          path: ["values", item.key],
          message: `Completa ${item.label}`,
        });
      if (value && item.options && !item.options.includes(value))
        context.addIssue({
          code: "custom",
          path: ["values", item.key],
          message: "Selección no válida",
        });
      if (
        value &&
        item.type === "number" &&
        (!Number.isFinite(Number(value)) ||
          Number(value) < 0 ||
          (item.key === "year" && (Number(value) < 1886 || Number(value) > 2100)))
      )
        context.addIssue({
          code: "custom",
          path: ["values", item.key],
          message: "Número fuera de rango",
        });
    }
  });
export type ServiceRequest = z.infer<typeof serviceRequestSchema>;
export function emptyServiceRequest(): ServiceRequest {
  return { category: "", subcategory: "", values: {} };
}
