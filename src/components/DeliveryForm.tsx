import { deliveryModes, type Delivery } from "@/lib/delivery";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
export function DeliveryForm({ value, onChange }: { value: Delivery; onChange: (value: Delivery) => void }) {
  return <fieldset className="space-y-3 border-y border-border py-4"><legend className="font-semibold">Entrega del producto</legend>
    <label className="block space-y-1 text-sm">Modalidad<select aria-label="Modalidad de entrega" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={value.mode} onChange={(event) => onChange({ ...value, mode: event.target.value as Delivery["mode"], cost: null })}>{Object.entries(deliveryModes).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
    {value.mode === "paid" && <label className="block space-y-1 text-sm">Costo adicional (moneda de la subasta)<Input aria-label="Costo adicional de entrega" type="number" min="0.01" step="0.01" value={value.cost ?? ""} onChange={(event) => onChange({ ...value, cost: event.target.value ? Number(event.target.value) : null })} /></label>}
    <label className="block space-y-1 text-sm">{value.mode === "other" ? "Describe la modalidad y condiciones" : "Condiciones y cobertura"}<Textarea aria-label="Condiciones de entrega" value={value.conditions} maxLength={2000} onChange={(event) => onChange({ ...value, conditions: event.target.value })} /></label>
  </fieldset>;
}