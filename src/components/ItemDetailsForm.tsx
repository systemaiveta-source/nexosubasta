import { ITEM_CATALOG, type ItemDetails } from "@/lib/item-catalog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ItemDetailsForm({ categorySlug, value, onChange }: {
  categorySlug: string;
  value: ItemDetails;
  onChange: (value: ItemDetails) => void;
}) {
  if (!categorySlug) return <p className="text-sm text-muted-foreground">Selecciona una categoría de artículo para mostrar su ficha específica.</p>;
  const category = ITEM_CATALOG[categorySlug] ?? ITEM_CATALOG.otros;
  const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
  return (
    <fieldset className="space-y-3 rounded-xl border border-border p-4">
      <legend className="px-1 font-semibold">{category.title}</legend>
      <p className="text-xs text-muted-foreground">Completa los datos que ayudan a los compradores a identificar y evaluar el artículo.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {category.fields.map((item) => (
          <label key={item.key} className={`block space-y-1 text-sm ${item.type === "textarea" ? "sm:col-span-2" : ""}`}>
            {item.label}{item.required ? " *" : " (opcional)"}
            {item.type === "select" ? (
              <select aria-label={item.label} className={selectClass} value={value.values[item.key] ?? ""} onChange={(e) => onChange({ ...value, values: { ...value.values, [item.key]: e.target.value } })}>
                <option value="">Elegir…</option>
                {item.options?.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            ) : item.type === "textarea" ? (
              <Textarea aria-label={item.label} value={value.values[item.key] ?? ""} maxLength={2000} onChange={(e) => onChange({ ...value, values: { ...value.values, [item.key]: e.target.value } })} />
            ) : (
              <Input aria-label={item.label} type={item.type ?? "text"} min={item.type === "number" ? 0 : undefined} value={value.values[item.key] ?? ""} maxLength={2000} onChange={(e) => onChange({ ...value, values: { ...value.values, [item.key]: e.target.value } })} />
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
