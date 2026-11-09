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
