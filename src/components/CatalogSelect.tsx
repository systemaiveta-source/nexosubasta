import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandItem } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { searchCatalog, currencySymbol, type CatalogOption } from "@/lib/catalog-search";
import { COUNTRIES, CURRENCIES } from "@/lib/currency";
const countries: CatalogOption[] = COUNTRIES.map(([code, label]) => ({
  code,
  label,
  value: label,
}));
const currencies: CatalogOption[] = CURRENCIES.map(([code, label]) => ({
  code,
  label,
  value: code,
  symbol: currencySymbol(code),
}));
export function CatalogSelect({
  kind,
  value,
  onChange,
  label,
  empty = "Elegir…",
}: {
  kind: "country" | "currency";
  value: string;
  onChange: (value: string) => void;
  label: string;
  empty?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const options = kind === "country" ? countries : currencies;
  const filtered = searchCatalog(options, query);
  const selected = options.find((option) => option.value === value);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          className="h-10 w-full min-w-0 justify-between font-normal"
        >
          <span className="truncate">
            {selected
              ? `${selected.code} — ${selected.label}${selected.symbol ? ` (${selected.symbol})` : ""}`
              : value || empty}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            aria-label={`Buscar ${label.toLowerCase()}`}
            placeholder="Nombre, código o símbolo"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {filtered.length === 0 && (
              <p role="status" className="p-3 text-sm text-muted-foreground">
                Sin coincidencias.
              </p>
            )}
            {filtered.map((option) => (
              <CommandItem
                key={option.code}
                value={option.code}
                onSelect={() => {
                  onChange(option.value);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span className="min-w-0 flex-1 break-words">
                  {option.code} — {option.label}
                  {option.symbol ? ` (${option.symbol})` : ""}
                </span>
                {value === option.value && <Check className="size-4 shrink-0" aria-hidden="true" />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
