import {useState} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Textarea} from "@/components/ui/textarea";
import {createSupport,listSupport,answerSupport} from "@/lib/support.functions";
import {toast} from "sonner";
export function MembershipSupport({admin=false}:{admin?:boolean}){
  const qc=useQueryClient();
  const requests=useQuery({queryKey:["support",admin],queryFn:()=>listSupport()});
  const [subject,setSubject]=useState("");
  const [body,setBody]=useState("");
  const [responses,setResponses]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);
  async function submit(id?:string){
    setBusy(true);
    try{
      if(id) await answerSupport({data:{id,response:responses[id]??""}});
      else {await createSupport({data:{subject,body}});setSubject("");setBody("");}
      await qc.invalidateQueries({queryKey:["support"]});toast.success(id?"Respuesta enviada":"Solicitud enviada");
    }catch {toast.error("No se pudo enviar. Revisa los campos e inténtalo de nuevo.");}
    finally{setBusy(false);}
  }
  const sorted=[...(requests.data??[])].sort((a,b)=>Number(b.priority)-Number(a.priority));
  return <section className="space-y-4 border-t border-border pt-6">
    <h2 className="font-display text-xl font-bold">{admin?"Solicitudes de soporte":"Soporte"}</h2>
    {!admin && <form className="max-w-xl space-y-3" onSubmit={e=>{e.preventDefault();void submit();}}>
      <Input aria-label="Asunto de soporte" placeholder="Asunto" required minLength={5} maxLength={120} value={subject} onChange={e=>setSubject(e.target.value)}/>
      <Textarea aria-label="Consulta de soporte" placeholder="Tu consulta" required minLength={10} maxLength={4000} value={body} onChange={e=>setBody(e.target.value)}/>
      <Button disabled={busy} type="submit">Enviar consulta</Button>
    </form>}
    {requests.error && <p role="alert">No se pudieron cargar las solicitudes.</p>}
    {sorted.map(r=><article key={r.id} className="space-y-2 border-b border-border py-3">
      <h3 className="break-words font-semibold">{r.priority?"Prioritaria · ":""}{r.subject}</h3>
      <p className="whitespace-pre-wrap break-words text-sm">{r.body}</p>
      {r.response && <p className="whitespace-pre-wrap break-words text-sm text-nexo-blue">NEXO: {r.response}</p>}
      {admin && <div className="space-y-2"><Textarea aria-label={`Respuesta a ${r.subject}`} value={responses[r.id]??""} onChange={e=>setResponses({...responses,[r.id]:e.target.value})}/><Button disabled={busy||!responses[r.id]} onClick={()=>submit(r.id)}>Responder</Button></div>}
    </article>)}
  </section>;
}