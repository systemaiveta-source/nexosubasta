import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { money, statusLabel, timeLeft } from "@/lib/format";
import { modeLabel } from "@/lib/auction-timing";

export type AuctionListItem = {
  id: string;
  title: string;
  images: string[];
  starting_price: number | null;
  auction_type?: string | null;
  current_price: number | null;
  currency: string;
  status: string;
  ends_at: string | null;
  starts_at: string | null;
  bid_count: number;
  city: string | null;
  country: string | null;
  has_reserve: boolean;
  reserve_met: boolean;
  closing_mode?: string | null;
};

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    active: "bg-nexo-green/15 text-nexo-green",
    scheduled: "bg-nexo-blue/15 text-nexo-blue",
    ended_sold: "bg-nexo-yellow/25 text-accent-foreground",
    ended_unsold: "bg-muted text-muted-foreground",
    cancelled: "bg-nexo-red/15 text-nexo-red",
    draft: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls[status] ?? "bg-muted"}`}
    >
      {statusLabel[status] ?? status}
    </span>
  );
}

export function AuctionCard({
  a,
  img,
  now,
}: {
  a: AuctionListItem;
  img?: string | undefined;
  now: number;
}) {
  return (
    <Link
      to="/subastas/$id"
      params={{ id: a.id }}
      className="group overflow-hidden rounded-xl border border-border bg-card shadow-soft transition hover:-translate-y-0.5"
    >
      <div className="aspect-[4/3] overflow-hidden bg-muted">
        {img ? (
          <img
            src={img}
            alt={a.title}
            loading="lazy"
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center text-muted-foreground">
            <ImageOff className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={a.status} />
          {a.status === "active" && (
            <span className="text-xs font-medium tabular-nums text-nexo-red">
              {timeLeft(a.ends_at, now)}
            </span>
          )}
        </div>
        <h3 className="line-clamp-2 font-semibold leading-snug">{a.title}</h3>
        <p className="text-xs font-medium text-muted-foreground">{a.auction_type === "service" ? "Servicio · ofertas descendentes" : modeLabel(a.closing_mode)}{a.status === "ended_unsold" && a.bid_count === 0 ? " · Sin ofertas" : ""}</p>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground">
              {a.current_price !== null
                ? "Oferta actual"
                : a.auction_type === "service"
                  ? "Solicitud de servicio"
                  : "Precio inicial"}
            </p>
            <p className="font-display text-lg font-bold">
              {a.auction_type === "service" && a.current_price === null
                ? "Sin ofertas"
                : money(a.current_price ?? a.starting_price, a.currency)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">{a.bid_count} ofertas</p>
        </div>
        {(a.city || a.country) && (
          <p className="text-xs text-muted-foreground">
            {[a.city, a.country].filter(Boolean).join(", ")}
          </p>
        )}
      </div>
    </Link>
  );
}

export const AUCTION_LIST_COLUMNS =
  "id,title,images,auction_type,starting_price,current_price,currency,status,ends_at,starts_at,bid_count,city,country,has_reserve,reserve_met,closing_mode";
