import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AUCTION_METHODS, auctionMethodSchema, type AuctionMethod } from "@/lib/auction-payments";
export function AuctionPaymentMethods({
  value,
  onChange,
}: {
  value: AuctionMethod[];
  onChange: (m: AuctionMethod[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"other" | "crypto">("other");
  const [name, setName] = useState("");
  const [asset, setAsset] = useState("");
  const [network, setNetwork] = useState("");
  const candidate = auctionMethodSchema.safeParse({ name, kind, asset, network });
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Métodos de pago aceptados</h3>
      <Input
        aria-label="Buscar método"
        placeholder="Buscar método"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {AUCTION_METHODS.filter((m) => m.name.toLowerCase().includes(search.toLowerCase())).map(
          (m) => (
            <label key={m.name} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.some((v) => v.name === m.name)}
                onChange={(e) =>
                  onChange(
                    e.target.checked ? [...value, m] : value.filter((v) => v.name !== m.name),
                  )
                }
              />
              {m.name}
            </label>
          ),
        )}
      </div>
      <div className="flex gap-2">
        <Button
          variant={kind === "other" ? "default" : "outline"}
          type="button"
          onClick={() => setKind("other")}
        >
          Otro
        </Button>
        <Button
          variant={kind === "crypto" ? "default" : "outline"}
          type="button"
          onClick={() => setKind("crypto")}
        >
          Criptomoneda
        </Button>
      </div>
      <Input
        aria-label="Nombre del método personalizado"
        placeholder="Nombre del método"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {kind === "crypto" && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            aria-label="Activo"
            placeholder="Activo (ej. USDT)"
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
          />
          <Input
            aria-label="Red"
            placeholder="Red"
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
          />
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={!candidate.success || value.length >= 20}
        onClick={() => {
          if (candidate.success) {
            onChange([...value, candidate.data]);
            setName("");
            setAsset("");
            setNetwork("");
          }
        }}
      >
        Añadir método
      </Button>
      <ul className="text-sm">
        {value
          .filter((v) => !AUCTION_METHODS.some((m) => m.name === v.name))
          .map((m, i) => (
            <li key={`${m.name}-${i}`} className="flex items-center justify-between gap-2">
              {m.name} {m.asset} {m.network}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onChange(value.filter((v) => v !== m))}
              >
                Quitar
              </Button>
            </li>
          ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        La disponibilidad depende de cada país y cuenta. NEXO no procesa ni verifica estos pagos.
      </p>
    </div>
  );
}
