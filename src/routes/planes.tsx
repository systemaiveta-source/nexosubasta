import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";

import { useAuth } from "@/lib/auth";
import { ManualMembershipCheckout, type CheckoutPlan } from "@/components/ManualMembershipCheckout";
import { MembershipRequests, snapshotMethod, snapshotPlan, type RequestRow } from "@/components/MembershipRequests";
import { methodConfig } from "@/lib/manual-payments";
import { QueryFailure } from "@/components/ManualPaymentShared";
import { money } from "@/lib/format";

export const Route = createFileRoute("/planes")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Membresías NEXO — Inicio, Impulso, Pro y Élite" },
      { name: "description", content: "Elige tu membresía NEXO: subasta más artículos, gana publicidad y comisiones por referidos." },
      { property: "og:title", content: "Membresías NEXO" },
      { property: "og:description", content: "Planes mensual, trimestral, semestral y anual con beneficios y referidos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Plans,
});

const periodLabel: Record<string, string> = { monthly: "Mensual", quarterly: "Trimestral", semiannual: "Semestral", annual: "Anual" };

function Plans() {
 const {user}=useAuth();const qc=useQueryClient();const [sel,setSel]=useState<string|null>(null);const [correct,setCorrect]=useState<RequestRow|null>(null);const [sent,setSent]=useState('');
 const plans=useQuery({queryKey:['plans'],queryFn:async()=>{const {data,error}=await supabase.from('plans').select('*').eq('active',true).order('months');if(error)throw error;return data;}});
 const methods=useQuery({queryKey:['pay-methods'],queryFn:async()=>{const {data,error}=await supabase.from('payment_methods').select('*').eq('active',true).order('sort');if(error)throw error;return data;}});
 const profile=useQuery({queryKey:['checkout-profile',user?.id],enabled:!!user,queryFn:async()=>{const {data,error}=await supabase.rpc('my_profile');if(error)throw error;return data;}});
 const subs=useQuery({queryKey:['checkout-membership',user?.id],enabled:!!user,queryFn:async()=>{const {data,error}=await supabase.from('subscriptions').select('id,status,ends_at,plans(name)').eq('status','active').gt('ends_at',new Date().toISOString());if(error)throw error;return data;}});
 const plan=correct?snapshotPlan(correct):plans.data?.find(p=>p.id===sel);
 const chosenPlan=plan&&('id' in plan)?plan as CheckoutPlan:correct&&plan?{...plan,id:correct.plan_id}:null;
 const applicable=(methods.data??[]).filter(m=>{const c=methodConfig(m.details);return c.currency===(chosenPlan?.currency??'USD')&&(!c.countries.length||c.countries.some(country=>country.toLowerCase()===profile.data?.country?.toLowerCase()));});
 const checkoutMethods=correct?applicable.filter(m=>m.id===correct.payment_method_id).map(()=>snapshotMethod(correct)):applicable;
 return <PageShell title="Membresías">
 {subs.data?.map(s=><p key={s.id} className="mb-4 border-l-2 border-nexo-green bg-secondary p-3 text-sm">Membresía {s.plans?.name} activa hasta {new Date(s.ends_at).toLocaleDateString('es')}</p>)}
 {plans.isError?<QueryFailure retry={()=>plans.refetch()}/>:plans.isPending?<p role="status">Cargando planes…</p>:<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{plans.data.map((p,i)=><div key={p.id} className={`flex min-w-0 flex-col rounded-lg border bg-card p-5 ${sel===p.id?'border-primary':'border-border'}`}><span className={`mb-3 h-1 w-10 ${['bg-nexo-red','bg-nexo-blue','bg-nexo-yellow','bg-nexo-green'][i%4]}`}/><h2 className="break-words text-lg font-semibold">{p.name}</h2><p className="text-sm text-muted-foreground">{periodLabel[p.period]??p.period} · {p.months} meses</p><p className="my-4 text-3xl font-bold">{money(p.price,p.currency)}</p><ul className="mb-5 flex-1 space-y-2 text-sm">{p.benefits.map(b=><li key={b}>• {b}</li>)}</ul>{user?<Button variant={sel===p.id?'default':'outline'} onClick={()=>{setSel(p.id);setCorrect(null);setSent('');}}>Elegir</Button>:<Button asChild variant="outline"><Link to="/auth" search={{redirect:'/planes'}}>Entrar para elegir</Link></Button>}</div>)}</div>}
 {sent&&<div role="status" className="mt-6 border-l-2 border-nexo-green bg-secondary p-4"><p className="font-semibold">Pendiente de revisión</p><p className="mt-1 break-all font-mono text-sm">Solicitud: {sent}</p><p className="mt-2 text-sm">Tu membresía se activará solo cuando el administrador apruebe el pago.</p></div>}
 {user&&chosenPlan&&(methods.isError?<QueryFailure retry={()=>methods.refetch()}/>:methods.isPending||profile.isPending?<p className="py-6">Cargando métodos…</p>:<div className="mt-8 max-w-3xl"><ManualMembershipCheckout key={correct?.id??chosenPlan.id} plan={chosenPlan} methods={checkoutMethods} requestId={correct?.id} initialValues={correct?.proof_values as Record<string,string>|undefined} onSent={id=>{setSent(id);setSel(null);setCorrect(null);qc.invalidateQueries({queryKey:['membership-requests']});}}/></div>)}
 {user&&<div className="mt-12 border-t border-border pt-8"><MembershipRequests onCorrect={r=>{setCorrect(r);setSel(null);setSent('');window.scrollTo({top:0,behavior:'smooth'});}}/></div>}
 </PageShell>;
}
