import { useQuery } from '@tanstack/react-query';
import { Copy, ExternalLink, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { dataLabels, methodConfig, paymentStatus, type PaymentMethod } from '@/lib/manual-payments';

export const paymentInput = 'w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm';
export function PrivateDocument({ path, image = false }: { path: string; image?: boolean }) {
  const q = useQuery({ queryKey: ['membership-file', path], staleTime: 240000, queryFn: async () => {
    const { data, error } = await supabase.storage.from('membership-documents').createSignedUrl(path, 300);
    if (error) throw error;
    return data.signedUrl;
  } });
  if (q.isPending) return <span className="text-sm text-muted-foreground">Cargando archivo…</span>;
  if (q.isError) return <p className="text-sm text-destructive">Archivo no disponible. <Button variant="link" onClick={() => q.refetch()}>Reintentar</Button></p>;
  return image ? <a href={q.data} target="_blank" rel="noopener noreferrer"><img src={q.data} alt="QR o instrucciones del método de pago" className="max-h-64 max-w-full rounded-md object-contain" /></a> : <Button asChild variant="outline" size="sm"><a href={q.data} target="_blank" rel="noopener noreferrer"><FileText className="size-4" />Abrir comprobante privado</a></Button>;
}
export function MethodDetails({ method }: { method: PaymentMethod }) {
  const config = methodConfig(method.details);
  return <div className="min-w-0 space-y-4">
    {config.description && <p className="text-sm text-muted-foreground break-words">{config.description}</p>}
    <dl className="grid gap-3 sm:grid-cols-2">
      {Object.entries(config.data).filter(([, v]) => v).map(([key, value]) => <div key={key} className="min-w-0 border-b border-border pb-2">
        <dt className="text-xs text-muted-foreground">{dataLabels[key] ?? key}</dt>
        <dd className="flex items-start gap-2 text-sm font-medium"><span className="min-w-0 flex-1 break-all whitespace-pre-wrap">{value}</span>
          <Button size="icon" variant="ghost" className="size-8 shrink-0" title={`Copiar ${dataLabels[key] ?? key}`} aria-label={`Copiar ${dataLabels[key] ?? key}`} onClick={async () => { try { await navigator.clipboard.writeText(value); toast.success('Dato copiado'); } catch { toast.error('No se pudo copiar'); } }}><Copy className="size-4" /></Button>
          {key === 'payment_link' && value.startsWith('https://') && <Button asChild size="icon" variant="ghost" className="size-8 shrink-0"><a href={value} target="_blank" rel="noopener noreferrer" aria-label="Abrir enlace de pago"><ExternalLink className="size-4" /></a></Button>}
        </dd></div>)}
      <div><dt className="text-xs text-muted-foreground">Moneda</dt><dd className="text-sm">{config.currency}</dd></div>
      {!!config.countries.length && <div><dt className="text-xs text-muted-foreground">Países</dt><dd className="break-words text-sm">{config.countries.join(', ')}</dd></div>}
    </dl>
    {config.qr_path && <PrivateDocument path={config.qr_path} image />}
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{method.instructions}</p>
  </div>;
}
export function Status({ status }: { status: string }) { return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${status === 'approved' ? 'bg-nexo-green/10 text-nexo-green' : status === 'rejected' ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-secondary-foreground'}`}>{paymentStatus[status] ?? status}</span>; }
export function QueryFailure({ retry }: { retry: () => void }) { return <div role="alert" className="border-l-2 border-destructive p-4 text-sm">No pudimos cargar los datos. <Button variant="link" onClick={retry}>Reintentar</Button></div>; }
