import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getOperation,
  changeOperation,
  sendOperationMessage,
  uploadOperationDocument,
  openOperationDocument,
} from "@/lib/operations.functions";
import { canComplete, nextOperationStage, operationStages } from "@/lib/operations";
import { errMsg, money, txStatusLabel } from "@/lib/format";
const options = (id: string) =>
  queryOptions({
    queryKey: ["operation", id],
    queryFn: () => getOperation({ data: { id } }),
    refetchInterval: 5000,
  });
export const Route = createFileRoute("/_authenticated/operaciones/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(options(params.id)),
  head: () => ({
    meta: [
      { title: "Acuerdo y chat privado — NEXO" },
      { name: "description", content: "Pago, entrega, mensajes y confirmaciones de la operación." },
      { property: "og:title", content: "Acuerdo y chat privado — NEXO" },
      { property: "og:description", content: "Coordinación privada entre las partes autorizadas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => (
    <PageShell title="Operación no disponible">
      <p>No existe o tu cuenta no tiene acceso.</p>
      <Link to="/operaciones" className="underline">
        Volver a operaciones
      </Link>
    </PageShell>
  ),
  component: Operation,
});
function Operation() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(options(id));
  const qc = useQueryClient();
  const change = useServerFn(changeOperation);
  const send = useServerFn(sendOperationMessage);
  const upload = useServerFn(uploadOperationDocument);
  const open = useServerFn(openOperationDocument);
  const [body, setBody] = useState("");
  const [path, setPath] = useState<string>();
  const [method, setMethod] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  const t = data.tx;
  const isBuyer = t.buyer_id === data.userId;
  const isParty = isBuyer || t.seller_id === data.userId;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["operation", id] });
    qc.invalidateQueries({ queryKey: ["operations"] });
  };
  async function action(action: "complete" | "dispute" | "stage", value?: string) {
    setBusy(true);
    try {
      await change({ data: { id, action, ...(value ? { value } : {}), method } });
      refresh();
      toast.success("Operación actualizada");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  const next = nextOperationStage(t.payment_stage, isBuyer);
  return (
    <PageShell title={data.auction?.title ?? "Operación privada"}>
      <Link to="/operaciones" className="text-sm underline">
        ← Operaciones
      </Link>
      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <section className="space-y-4">
          <p className="text-2xl font-bold">{money(t.amount, t.currency)}</p>
          <p>
            {txStatusLabel[t.status]} · {operationStages[t.payment_stage]}
          </p>
          <p className="text-sm">
            {isBuyer ? "Comprador / Cliente" : "Subastador / Proveedor"} ·{" "}
            {data.contact?.[0]?.display_name ?? "Contraparte autorizada"}
          </p>
          {t.agreed_method && <p className="break-words">Método acordado: {t.agreed_method}</p>}
          <p className="text-sm text-muted-foreground">
            NEXO no procesa ni verifica este pago. Un comprobante no confirma recepción de fondos.
          </p>
          {isParty && t.status === "pending" && (
            <>
              <div className="space-y-2">
                {t.payment_stage === "coordination" ? (
                  <>
                    <Input
                      aria-label="Método acordado"
                      placeholder="Método acordado por ambas partes"
                      value={method}
                      onChange={(e) => setMethod(e.target.value)}
                      maxLength={200}
                    />
                    <Button
                      disabled={busy || method.trim().length < 2}
                      onClick={() => action("stage", "payment_pending")}
                    >
                      Registrar acuerdo de pago
                    </Button>
                  </>
                ) : (
                  next && (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        if (
                          next !== "payment_confirmed" ||
                          confirm("¿Confirmas que recibiste los fondos?")
                        )
                          action("stage", next);
                      }}
                    >
                      {next === "payment_confirmed"
                        ? "Confirmar recepción de fondos"
                        : operationStages[next]}
                    </Button>
                  )
                )}
              </div>
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-sm">
                  Tu confirmación:{" "}
                  {(isBuyer ? t.buyer_confirmed : t.seller_confirmed) ? "Registrada" : "Pendiente"}{" "}
                  · Contraparte:{" "}
                  {(isBuyer ? t.seller_confirmed : t.buyer_confirmed) ? "Registrada" : "Pendiente"}
                </p>
                <Button
                  disabled={
                    busy ||
                    !canComplete(
                      t.status,
                      t.buyer_confirmed,
                      t.seller_confirmed,
                      isBuyer,
                      t.payment_stage,
                    )
                  }
                  onClick={() => {
                    if (confirm("¿Confirmas que tu parte del acuerdo se completó?"))
                      action("complete");
                  }}
                >
                  Marcar como completado
                </Button>
              </div>
              <Textarea
                aria-label="Motivo de disputa"
                placeholder="Motivo de disputa"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={2000}
              />
              <Button
                variant="destructive"
                disabled={busy || reason.trim().length < 5}
                onClick={() => action("dispute", reason)}
              >
                Abrir disputa
              </Button>
            </>
          )}
          {data.disputes.map((d) => (
            <div key={d.id} className="border-l-2 border-destructive pl-3">
              <p className="font-semibold">Disputa: {d.status}</p>
              <p className="whitespace-pre-wrap break-words">{d.reason}</p>
              {d.resolution && <p>{d.resolution}</p>}
            </div>
          ))}
          <h2 className="font-semibold">Historial de estados</h2>
          <ul className="space-y-2 text-sm">
            {data.events.map((e) => (
              <li key={e.id}>
                {e.kind === "completion_confirmed"
                  ? "Confirmación de finalización"
                  : "Cambio de estado"}{" "}
                · {new Date(e.created_at).toLocaleString("es")}
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="mb-3 text-xl font-semibold">Chat privado</h2>
          <ul className="max-h-[600px] space-y-3 overflow-y-auto border-y border-border py-4">
            {data.messages.length ? (
              data.messages.map((m) => (
                <li
                  key={m.id}
                  className={`max-w-[90%] rounded-md p-3 ${m.sender_id === data.userId ? "ml-auto bg-secondary" : "bg-muted"}`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  {m.attachment_path && (
                    <Button
                      variant="link"
                      size="sm"
                      onClick={async () => {
                        try {
                          const r = await open({ data: { path: m.attachment_path ?? "" } });
                          window.open(r.url, "_blank", "noopener,noreferrer");
                        } catch (e) {
                          toast.error(errMsg(e));
                        }
                      }}
                    >
                      Abrir adjunto privado
                    </Button>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(m.created_at).toLocaleString("es")}
                  </p>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground">Todavía no hay mensajes.</li>
            )}
          </ul>
          {isParty && t.status !== "cancelled" && (
            <form
              className="mt-4 space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await send({ data: { id, body, key: key.current, ...(path ? { path } : {}) } });
                  key.current = crypto.randomUUID();
                  setBody("");
                  setPath(undefined);
                  refresh();
                } catch (error) {
                  toast.error(errMsg(error));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Textarea
                aria-label="Mensaje"
                placeholder="Escribe a la contraparte"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={2000}
                required
              />
              <label className="block text-sm">
                Adjunto privado (JPG, PNG, WebP o PDF, máximo 10 MB)
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  disabled={busy || t.status !== "pending"}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setBusy(true);
                    try {
                      const form = new FormData();
                      form.set("id", id);
                      form.set("file", file);
                      const result = await upload({ data: form });
                      setPath(result.path);
                      toast.success("Adjunto privado guardado");
                    } catch (error) {
                      toast.error(errMsg(error));
                    } finally {
                      setBusy(false);
                    }
                  }}
                />
              </label>
              {path && <p className="text-sm text-nexo-green">Adjunto listo para enviar</p>}
              <Button disabled={busy || !body.trim()} type="submit">
                {busy ? "Enviando…" : "Enviar mensaje"}
              </Button>
            </form>
          )}
        </section>
      </div>
    </PageShell>
  );
}
