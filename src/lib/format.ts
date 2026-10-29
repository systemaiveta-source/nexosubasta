export function money(v: number | string | null | undefined, currency = "USD") {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("es", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(v));
}

export function timeLeft(endsAt: string | null, now: number) {
  if (!endsAt) return "";
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return "Finalizada";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec.toString().padStart(2, "0")}s`;
}

export const statusLabel: Record<string, string> = {
  draft: "Borrador",
  scheduled: "Programada",
  active: "Activa",
  ended_sold: "Adjudicada",
  ended_unsold: "Sin venta",
  cancelled: "Cancelada",
};

export const txStatusLabel: Record<string, string> = {
  pending: "Pendiente",
  completed: "Completada",
  disputed: "En disputa",
  cancelled: "Cancelada",
};

export const scopeLabel: Record<string, string> = {
  local: "Local",
  national: "Nacional",
  international: "Internacional",
};

/** Minimum next valid bid, mirroring the server rule (server is authoritative). */
export function minNextBid(
  startingPrice: number,
  currentPrice: number | null,
  minIncrement: number,
) {
  return currentPrice === null
    ? startingPrice
    : Math.round((currentPrice + minIncrement) * 100) / 100;
}

export function errMsg(e: unknown) {
  if (e && typeof e === "object" && "message" in e)
    return String((e as { message: string }).message);
  return "Ha ocurrido un error";
}

export function newIdempotencyKey() {
  return crypto.randomUUID();
}
