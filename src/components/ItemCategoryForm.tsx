import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ItemCategory = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
};

export type ItemAttributeField = {
  key: string;
  label: string;
  type?: "text" | "number" | "select" | "textarea";
  options?: string[];
  required?: boolean;
};

const commonCondition: ItemAttributeField = {
  key: "condition",
  label: "Estado del artículo",
  type: "select",
  options: ["Nuevo", "Como nuevo", "Usado - excelente", "Usado - bueno", "Usado - regular", "Para reparar"],
  required: true,
};

const schemas: Record<string, ItemAttributeField[]> = {
  autos: [
    { key: "make", label: "Marca", required: true },
    { key: "model", label: "Modelo", required: true },
    { key: "year", label: "Año", type: "number", required: true },
    { key: "engine", label: "Motor / cilindrada" },
    { key: "mileage", label: "Kilometraje", type: "number" },
    { key: "fuel", label: "Combustible", type: "select", options: ["Gasolina", "Diésel", "Híbrido", "Eléctrico", "Gas"] },
    { key: "transmission", label: "Transmisión", type: "select", options: ["Manual", "Automática", "CVT", "Otra"] },
    { key: "color", label: "Color" },
    commonCondition,
  ],
  motocicletas: [
    { key: "make", label: "Marca", required: true }, { key: "model", label: "Modelo", required: true },
    { key: "year", label: "Año", type: "number", required: true }, { key: "engine", label: "Cilindrada (cc)", type: "number" },
    { key: "mileage", label: "Kilometraje", type: "number" }, { key: "transmission", label: "Transmisión" },
    { key: "color", label: "Color" }, commonCondition,
  ],
  camiones: [
    { key: "make", label: "Marca", required: true }, { key: "model", label: "Modelo", required: true },
    { key: "year", label: "Año", type: "number", required: true }, { key: "engine", label: "Motor" },
    { key: "capacity", label: "Capacidad de carga" }, { key: "mileage", label: "Kilometraje", type: "number" },
    { key: "fuel", label: "Combustible" }, commonCondition,
  ],
  telefonos: [
    { key: "make", label: "Marca", required: true }, { key: "model", label: "Modelo", required: true },
    { key: "storage", label: "Almacenamiento", type: "select", options: ["32 GB", "64 GB", "128 GB", "256 GB", "512 GB", "1 TB"] },
    { key: "memory", label: "Memoria RAM" }, { key: "color", label: "Color" },
    { key: "unlocked", label: "Estado de liberación", type: "select", options: ["Liberado", "Operador específico", "No sé"] }, commonCondition,
  ],
  computadoras: [
    { key: "make", label: "Marca", required: true }, { key: "model", label: "Modelo", required: true },
    { key: "processor", label: "Procesador" }, { key: "memory", label: "Memoria RAM" },
    { key: "storage", label: "Almacenamiento" }, { key: "screen", label: "Tamaño de pantalla" }, commonCondition,
  ],
  electrodomesticos: [
    { key: "make", label: "Marca", required: true }, { key: "model", label: "Modelo" },
    { key: "type", label: "Tipo de electrodoméstico", required: true }, { key: "capacity", label: "Capacidad" },
    { key: "color", label: "Color" }, { key: "voltage", label: "Voltaje" }, commonCondition,
  ],
  casas: [
    { key: "property_type", label: "Tipo de propiedad", type: "select", options: ["Casa", "Apartamento", "Condominio", "Otro"], required: true },
    { key: "bedrooms", label: "Habitaciones", type: "number" }, { key: "bathrooms", label: "Baños", type: "number" },
    { key: "land_area", label: "Área de terreno (m²)", type: "number" }, { key: "built_area", label: "Área construida (m²)", type: "number" },
    { key: "parking", label: "Estacionamientos", type: "number" }, { key: "property_condition", label: "Estado", type: "select", options: ["Nueva", "Excelente", "Buena", "Para remodelar"] },
  ],
  terrenos: [
    { key: "land_area", label: "Área del terreno (m²)", type: "number", required: true },
    { key: "land_use", label: "Uso de suelo" }, { key: "frontage", label: "Frente y fondo" },
    { key: "services", label: "Servicios disponibles", type: "textarea" }, { key: "access", label: "Acceso" },
  ],
  muebles: [
    { key: "type", label: "Tipo de mueble", required: true }, { key: "material", label: "Material" },
    { key: "dimensions", label: "Dimensiones" }, { key: "color", label: "Color" },
    { key: "brand", label: "Fabricante / marca" }, commonCondition,
  ],
  ropa: [
    { key: "type", label: "Tipo de prenda", required: true }, { key: "brand", label: "Marca" },
    { key: "size", label: "Talla", required: true }, { key: "gender", label: "Público", type: "select", options: ["Mujer", "Hombre", "Unisex", "Niño", "Niña"] },
    { key: "material", label: "Material" }, { key: "color", label: "Color" }, commonCondition,
  ],
  calzado: [
    { key: "brand", label: "Marca", required: true }, { key: "model", label: "Modelo" },
    { key: "size", label: "Talla", required: true }, { key: "gender", label: "Público" },
    { key: "color", label: "Color" }, commonCondition,
  ],
  maquinaria: [
    { key: "make", label: "Fabricante", required: true }, { key: "model", label: "Modelo", required: true },
    { key: "year", label: "Año", type: "number" }, { key: "power", label: "Potencia" },
    { key: "hours_used", label: "Horas de uso", type: "number" }, { key: "fuel", label: "Combustible" }, commonCondition,
  ],
};

export function getItemAttributeFields(slug: string): ItemAttributeField[] {
  return schemas[slug] ?? [
    { key: "brand", label: "Marca / fabricante" },
    { key: "model", label: "Modelo o referencia" },
    { key: "specifications", label: "Características principales", type: "textarea", required: true },
    commonCondition,
  ];
}

export function validateItemAttributes(slug: string, values: Record<string, string>): string | null {
  for (const field of getItemAttributeFields(slug)) {
    const value = values[field.key]?.trim() ?? "";
    if (field.required && !value) return `Completa el campo "${field.label}".`;
    if (value && field.type === "number") {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0) return `Revisa el campo "${field.label}".`;
      if (field.key === "year" && (number < 1886 || number > new Date().getFullYear() + 1))
        return "El año del artículo no es válido.";
    }
  }
  return null;
}

export function ItemCategoryForm({
  categories,
  categoryId,
  onCategoryChange,
  values,
  onValuesChange,
}: {
  categories: ItemCategory[];
  categoryId: string;
  onCategoryChange: (id: string) => void;
  values: Record<string, string>;
  onValuesChange: (values: Record<string, string>) => void;
}) {
  const selected = categories.find((category) => category.id === categoryId);
  const rootId = selected?.parent_id ?? selected?.id ?? "";
  const roots = categories.filter((category) => !category.parent_id);
  const children = categories.filter((category) => category.parent_id === rootId);
  const selectedSlug = selected?.slug ?? "";
  const fields = selected ? getItemAttributeFields(selectedSlug) : [];
  const inputClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <div className="space-y-1.5">
        <Label>Categoría principal</Label>
        <select className={inputClass} value={rootId} onChange={(event) => onCategoryChange(event.target.value)}>
          <option value="">Elegir categoría…</option>
          {roots.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </div>
      {rootId && children.length > 0 && (
        <div className="space-y-1.5">
          <Label>Subcategoría</Label>
          <select
            className={inputClass}
            value={selected?.parent_id ? selected.id : ""}
            onChange={(event) => { onCategoryChange(event.target.value); onValuesChange({}); }}
          >
            <option value="">Elegir subcategoría…</option>
            {children.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
      )}
      {selected && !selected.parent_id && children.length === 0 && (
        <p className="text-sm text-muted-foreground">Esta categoría no tiene subcategorías; se utilizará como categoría final.</p>
      )}
      {selected && (
        <div className="space-y-3 border-t border-border pt-4">
          <div>
            <h3 className="font-semibold">Características de {selected.name}</h3>
            <p className="text-xs text-muted-foreground">Completa los datos específicos para que los compradores puedan comparar artículos.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((field) => (
              <label key={field.key} className={`space-y-1.5 text-sm ${field.type === "textarea" ? "sm:col-span-2" : ""}`}>
                <span>{field.label}{field.required ? " *" : ""}</span>
                {field.type === "select" ? (
                  <select className={inputClass} value={values[field.key] ?? ""} onChange={(event) => onValuesChange({ ...values, [field.key]: event.target.value })}>
                    <option value="">Elegir…</option>
                    {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={1000} value={values[field.key] ?? ""} onChange={(event) => onValuesChange({ ...values, [field.key]: event.target.value })} />
                ) : (
                  <Input type={field.type ?? "text"} min={field.type === "number" ? 0 : undefined} maxLength={120} value={values[field.key] ?? ""} onChange={(event) => onValuesChange({ ...values, [field.key]: event.target.value })} />
                )}
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
