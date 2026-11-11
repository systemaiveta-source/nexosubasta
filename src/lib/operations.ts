export const operationStages: Record<string, string> = {
  coordination: "Coordinación pendiente",
  payment_pending: "Pago pendiente",
  receipt_sent: "Comprobante enviado",
  payment_confirmed: "Pago confirmado por la contraparte",
  delivery_pending: "Entrega o servicio pendiente",
  completion_pending: "Finalización pendiente",
};
export function canComplete(
  status: string,
  buyerConfirmed: boolean,
  sellerConfirmed: boolean,
  isBuyer: boolean,
  bothAccepted = false,
  openDispute = false,
) {
  return status === "pending" && bothAccepted && !openDispute && !(isBuyer ? buyerConfirmed : sellerConfirmed);
}
export function chatWritable(status: string) {
  return status === "pending" || status === "disputed";
}
export function mutuallyComplete(
  status: string,
  bothAccepted: boolean,
  buyer: boolean,
  seller: boolean,
  openDispute: boolean,
) {
  return status === "pending" && bothAccepted && buyer && seller && !openDispute;
}

export type OperationPhase =
  | "pending_acceptance" | "awaiting_buyer_acceptance" | "awaiting_seller_acceptance"
  | "coordinating" | "awaiting_one_confirmation" | "completed" | "disputed" | "cancelled";

export const operationPhaseLabels: Record<OperationPhase, string> = {
  pending_acceptance: "Pendiente de aceptación",
  awaiting_buyer_acceptance: "Esperando aceptación del comprador",
  awaiting_seller_acceptance: "Esperando aceptación del vendedor",
  coordinating: "Coordinando pago y entrega",
  awaiting_one_confirmation: "Esperando confirmación de una de las partes",
  completed: "Completada por ambas partes",
  disputed: "En disputa",
  cancelled: "Cancelada",
};

/** Derives the visible phase only from server-stored transaction fields. */
export function operationPhase(t: {
  status: string;
  buyer_payment_accepted_at?: string | null;
  seller_payment_accepted_at?: string | null;
  buyer_confirmed: boolean;
  seller_confirmed: boolean;
}, openDispute = false): OperationPhase {
  if (t.status === "completed") return "completed";
  if (t.status === "cancelled") return "cancelled";
  if (t.status === "disputed" || openDispute) return "disputed";
  const b = !!t.buyer_payment_accepted_at, s = !!t.seller_payment_accepted_at;
  if (!b && !s) return "pending_acceptance";
  if (!b) return "awaiting_buyer_acceptance";
  if (!s) return "awaiting_seller_acceptance";
  if (t.buyer_confirmed !== t.seller_confirmed) return "awaiting_one_confirmation";
  return "coordinating";
}
