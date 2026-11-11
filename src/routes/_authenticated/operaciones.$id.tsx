import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getOperation,
  changeOperation,
  sendOperationMessage,
  uploadOperationDocument,
  openOperationDocument,
} from "@/lib/operations.functions";
import { canComplete, chatWritable, operationPhase, operationPhaseLabels } from "@/lib/operations";
import { errMsg, money, txStatusLabel } from "@/lib/format";
import { useImageUrls } from "@/lib/images";
const options = (id: string) =>
  queryOptions({
    queryKey: ["operation", id],
    queryFn: () => getOperation({ data: { id } }),
    refetchInterval: 5000,
  });
export const Route = createFileRoute("/_authenticated/operaciones/$id")({
  staticData: { sitemap: false },
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
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  const t = data.tx;
  const imagePath = data.auction?.images?.[0];
  const images = useImageUrls(imagePath ? [imagePath] : []);
  const isBuyer = t.buyer_id === data.userId;
  const isParty = isBuyer || t.seller_id === data.userId;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["operation", id] });
    qc.invalidateQueries({ queryKey: ["operations"] });
  };
  async function action(action: "complete" | "dispute" | "accept", value?: string) {
    setBusy(true);
    try {
      await change({ data: { id, action, ...(value ? { value } : {}) } });
      refresh();
      toast.success("Operación actualizada");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  const bothAccepted = !!t.buyer_payment_accepted_at && !!t.seller_payment_accepted_at;
  const mineCompleted = isBuyer ? t.buyer_confirmed : t.seller_confirmed;
  const openDispute = data.disputes.some(d => d.status === "open");
  return (
    <PageShell title={data.auction?.title ?? "Operación privada"}>
      <Link to="/operaciones" className="text-sm underline">
        ← Operaciones
      </Link>
      <header className="mt-3 flex items-center gap-3 border-b border-border pb-3">
        {imagePath && images.data?.[imagePath] && <img src={images.data[imagePath]} alt={data.auction?.title ?? "Artículo"} className="h-16 w-16 shrink-0 rounded-md object-cover" />}
        <div className="min-w-0"><p className="break-words font-semibold">{data.auction?.title}</p><p className="text-sm">{money(t.amount,t.currency)} · {isBuyer ? "Comprador / Cliente" : "Subastador / Proveedor"}</p><p className="text-sm text-muted-foreground">{data.contact?.find(c => c.user_id !== data.userId)?.display_name ?? "Contraparte autorizada"} · Ref. {id.slice(0,8)}</p></div>
      </header>
      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <section className="order-2 space-y-4 lg:order-1">
          <p className="text-2xl font-bold">{money(t.amount, t.currency)}</p>
          <p className="font-semibold">{operationPhaseLabels[operationPhase(t, openDispute)]}</p>
          <ul className="text-sm">
            <li>Comprador: {t.buyer_confirmed ? "✓ marcó completado" : "pendiente"}</li>
            <li>Vendedor: {t.seller_confirmed ? "✓ marcó completado" : "pendiente"}</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            NEXO no procesa, custodia ni verifica este pago. Un mensaje o comprobante no confirma recepción de fondos.
          </p>
          {isParty && (t.status === "pending" || t.status === "disputed") && (
            <>
              <fieldset className="space-y-3 border-y border-border py-4">
                <legend className="font-semibold">Acuerdo de coordinación del pago</legend>
                {(["buyer", "seller"] as const).map(role => {
                  const own = (role === "buyer") === isBuyer;
                  const accepted = role === "buyer" ? t.buyer_payment_accepted_at : t.seller_payment_accepted_at;
                  return <label key={role} className="flex items-start gap-3 text-sm">
                    <Checkbox
                      aria-label={`Aceptación de ${role === "buyer" ? "comprador" : "vendedor"}`}
                      checked={!!accepted}
                      disabled={!own || !!accepted || busy}
                      onCheckedChange={checked => { if (own && checked === true) action("accept"); }}
                      className="mt-1"
                    />
                    <span><span className="block font-semibold">{role === "buyer" ? "Comprador / Cliente" : "Vendedor / Proveedor"}{own ? " (tú)" : ""}</span>
                      Confirmo que conozco y acepto coordinar el pago con la contraparte mediante el método acordado en este chat
                    </span>
                  </label>;
                })}
              </fieldset>
              <p className="text-sm" role="status">
                {mineCompleted ? "Tu confirmación registrada; falta la contraparte" :
                  !bothAccepted ? "Falta la aceptación de ambas partes para marcar como completado." :
                    "Ambas partes aceptaron coordinar el pago en este chat."}
              </p>
              <Button
                disabled={busy || !canComplete(t.status, t.buyer_confirmed, t.seller_confirmed, isBuyer, bothAccepted, openDispute)}
                onClick={() => {
                  if (confirm("¿Confirmas que la operación se completó según tu acuerdo con la contraparte?")) action("complete");
                }}
              >Marcar como completado</Button>
              {t.status === "pending" && <details className="border-t border-border pt-3">
                <summary className="cursor-pointer text-sm text-muted-foreground">Tengo un problema · Abrir disputa</summary>
                <div className="mt-3 space-y-3">
                  <Textarea aria-label="Motivo de disputa" placeholder="Motivo de disputa" value={reason} onChange={e => setReason(e.target.value)} maxLength={2000} />
                  <Button variant="destructive" disabled={busy || reason.trim().length < 5} onClick={() => action("dispute", reason)}>Abrir disputa</Button>
                </div>
              </details>}
            </>
          )}
          {data.disputes.map((d) => (
            <div key={d.id} className="border-l-2 border-destructive pl-3">
              <p className="font-semibold">Disputa: {d.status}</p>
              <p className="whitespace-pre-wrap break-words">{d.reason}</p>
              {d.resolution && <p>{d.resolution}</p>}
            </div>
          ))}
          {isParty && t.status === "completed" && (
            <ReviewSection txId={id} userId={data.userId} />
          )}
          <h2 className="font-semibold">Historial de estados</h2>
          <ul className="space-y-2 text-sm">
            {data.events.map((e) => (
              <li key={e.id}>
                {e.kind === "completion_confirmed"
                  ? "Confirmación de finalización"
                  : e.kind === "payment_coordination_accepted" ? "Aceptación de coordinación del pago" : "Cambio de estado"}{" "}
                · {new Date(e.created_at).toLocaleString("es")}
              </li>
            ))}
          </ul>
        </section>
        <section className="order-1 lg:order-2">
          <h2 className="mb-3 text-xl font-semibold">Chat privado</h2>
          {!chatWritable(t.status) && (
            <p role="status" className="mb-3 border-l-2 border-primary pl-3 font-medium">
              Operación y conversación cerradas. Historial y adjuntos en solo lectura.
            </p>
          )}
          <ul className="max-h-[35dvh] space-y-3 overflow-y-auto border-y border-border py-4 lg:max-h-[600px]">
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
          {isParty && chatWritable(t.status) && (
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

function ReviewSection({ txId, userId }: { txId: string; userId: string }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = useQuery({
    queryKey: ["my-review", txId, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("rating,comment")
        .eq("transaction_id", txId)
        .eq("reviewer_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function submit() {
    if (rating < 1) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("leave_review", {
        _tx: txId,
        _rating: rating,
        _comment: comment,
      });
      if (error) throw error;
      toast.success("Gracias por tu calificación");
      qc.invalidateQueries({ queryKey: ["my-review", txId, userId] });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const stars = (value: number, onPick?: (n: number) => void) => (
    <div className="flex gap-1" role={onPick ? "radiogroup" : undefined} aria-label="Calificación de 1 a 5 estrellas">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onPick}
          onClick={() => onPick?.(n)}
          aria-label={`${n} estrella${n === 1 ? "" : "s"}`}
          className={onPick ? "transition hover:scale-110" : "cursor-default"}
        >
          <Star
            className={`h-6 w-6 ${n <= value ? "fill-nexo-yellow text-nexo-yellow" : "text-muted-foreground"}`}
          />
        </button>
      ))}
    </div>
  );

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="font-semibold">Califica a tu contraparte</h2>
      {mine.data ? (
        <div className="space-y-1">
          {stars(mine.data.rating)}
          {mine.data.comment && (
            <p className="text-sm text-muted-foreground">Tu comentario: {mine.data.comment}</p>
          )}
          <p className="text-xs text-muted-foreground">Ya enviaste tu calificación.</p>
        </div>
      ) : (
        <>
          {stars(rating, setRating)}
          <Textarea
            aria-label="Comentario (opcional)"
            placeholder="Comentario opcional sobre la operación"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={1000}
          />
          <Button disabled={busy || rating < 1} onClick={submit}>
            Enviar calificación
          </Button>
        </>
      )}
    </section>
  );
}
