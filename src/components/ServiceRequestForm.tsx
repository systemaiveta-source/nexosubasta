import { SERVICE_CATALOG, type ServiceRequest } from "@/lib/service-catalog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
export function ServiceRequestForm({ value, onChange }: { value: ServiceRequest; onChange: (value: ServiceRequest) => void }) {
  const category = SERVICE_CATALOG.find((entry) => entry.id === value.category);
  const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  return <fieldset className="space-y-4 border-y border-border py-4"><legend className="font-semibold">Detalles privados para proveedores elegibles</legend>
    <label className="block space-y-1 text-sm">Categoría de servicio<select aria-label="Categoría de servicio" className={selectClass} value={value.category} onChange={(event) => onChange({ category: event.target.value, subcategory: "", values: {} })}><option value="">Elegir…</option>{SERVICE_CATALOG.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
    {category && <><label className="block space-y-1 text-sm">Subcategoría<select aria-label="Subcategoría" className={selectClass} value={value.subcategory} onChange={(event) => onChange({ ...value, subcategory: event.target.value })}><option value="">Elegir…</option>{category.subcategories.map((name) => <option key={name}>{name}</option>)}</select></label>
      <div className="grid gap-3 sm:grid-cols-2">{category.fields.filter((item) => !item.when || value.values[item.when[0]] === item.when[1]).map((item) => <label key={item.key} className={`block space-y-1 text-sm ${item.type === "textarea" ? "sm:col-span-2" : ""}`}>{item.label}{item.required ? " *" : ""}
        {item.type === "select" ? <select aria-label={item.label} className={selectClass} value={value.values[item.key] ?? ""} onChange={(event) => onChange({ ...value, values: { ...value.values, [item.key]: event.target.value } })}><option value="">Elegir…</option>{item.options?.map((option) => <option key={option}>{option}</option>)}</select> : item.type === "textarea" ? <Textarea aria-label={item.label} value={value.values[item.key] ?? ""} maxLength={2000} onChange={(event) => onChange({ ...value, values: { ...value.values, [item.key]: event.target.value } })} /> : <Input aria-label={item.label} type={item.type ?? "text"} value={value.values[item.key] ?? ""} maxLength={2000} onChange={(event) => onChange({ ...value, values: { ...value.values, [item.key]: event.target.value } })} />}
      </label>)}</div></>}
  </fieldset>;
}