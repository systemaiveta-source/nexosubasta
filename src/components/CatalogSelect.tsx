import { useState } from "react";
import { Input } from "@/components/ui/input";
import { searchCatalog, currencySymbol, type CatalogOption } from "@/lib/catalog-search";
import { COUNTRIES, CURRENCIES } from "@/lib/currency";
const countries: CatalogOption[] = COUNTRIES.map(([code, label]) => ({ code, label, value: label }));
const currencies: CatalogOption[] = CURRENCIES.map(([code, label]) => ({ code, label, value: code, symbol: currencySymbol(code) }));
export function CatalogSelect({ kind, value, onChange, label, empty = "Elegir…" }: { kind: "country" | "currency"; value: string; onChange: (value: string) => void; label: string; empty?: string }) {
  const [query, setQuery] = useState("");
  const options = kind === "country" ? countries : currencies;
  const filtered = searchCatalog(options, query);
  const selected = options.find((option) => option.value === value);
  const visible = selected && !filtered.includes(selected) ? [selected, ...filtered] : filtered;
  return <div className="min-w-0 space-y-2">
    <Input type="search" aria-label={`Buscar ${label.toLowerCase()}`} placeholder="Nombre, código o símbolo" value={query} onChange={(event) => setQuery(event.target.value)} />
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm">
      <option value="">{empty}</option>
      {visible.map((option) => <option key={option.code} value={option.value}>{option.code} — {option.label}{option.symbol ? ` (${option.symbol})` : ""}</option>)}
    </select>
    {filtered.length === 0 && <p role="status" className="text-xs text-muted-foreground">Sin coincidencias.</p>}
  </div>;
}