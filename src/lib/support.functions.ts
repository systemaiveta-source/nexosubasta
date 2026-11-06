import {createServerFn} from "@tanstack/react-start";
import {requireSupabaseAuth} from "@/integrations/supabase/auth-middleware";
import {z} from "zod";
export const listSupport = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).handler(async ({context})=>{
  const role=await context.supabase.rpc("is_staff",{_user_id:context.userId});
  if(role.error) throw new Error("No se pudo comprobar el acceso");
  let query=context.supabase.from("support_requests").select("*").order("created_at",{ascending:false});
  if(!role.data) query=query.eq("user_id",context.userId);
  const result=await query;
  if(result.error) throw new Error("No se pudo cargar soporte");
  return Promise.all(result.data.map(async request=>{
    const benefit=await context.supabase.rpc("membership_benefits",{_user:request.user_id});
    const parsed=z.object({priority_support:z.boolean().optional()}).safeParse(benefit.data);
    return {...request,priority:parsed.success && parsed.data.priority_support===true};
  }));
});
export const createSupport=createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
  .inputValidator((data:{subject:string;body:string})=>z.object({subject:z.string().trim().min(5).max(120),body:z.string().trim().min(10).max(4000)}).parse(data))
  .handler(async ({context,data})=>{
    const result=await context.supabase.from("support_requests").insert({...data,user_id:context.userId});
    if(result.error) throw new Error("No se pudo enviar tu solicitud");
    return {ok:true};
  });
export const answerSupport=createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
  .inputValidator((data:{id:string;response:string})=>z.object({id:z.string().uuid(),response:z.string().trim().min(1).max(4000)}).parse(data))
  .handler(async ({context,data})=>{
    const result=await context.supabase.rpc("answer_support",{_id:data.id,_response:data.response});
    if(result.error) throw new Error("No se pudo responder la solicitud");
    return {ok:true};
  });