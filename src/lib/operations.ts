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
  stage = "completion_pending",
) {
  return (
    status === "pending" &&
    stage === "completion_pending" &&
    !(isBuyer ? buyerConfirmed : sellerConfirmed)
  );
}
export function nextOperationStage(stage: string, isBuyer: boolean): string | null {
  if (stage === "payment_pending") return isBuyer ? "receipt_sent" : "payment_confirmed";
  if (stage === "receipt_sent") return isBuyer ? null : "payment_confirmed";
  if (stage === "payment_confirmed") return "delivery_pending";
  if (stage === "delivery_pending") return "completion_pending";
  return null;
}
export function chatWritable(status: string) { return status === "pending" || status === "disputed"; }
export function mutuallyComplete(status: string, stage: string, buyer: boolean, seller: boolean, openDispute: boolean) {
  return status === "pending" && stage === "completion_pending" && buyer && seller && !openDispute;
}
