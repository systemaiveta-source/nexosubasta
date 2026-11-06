import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {it, expect, vi} from "vitest";
import {retryPush} from "./push-delivery";
it("background worker shows notification and public thumbnail without an open client", async () => {
  const handlers: Record<string, (event: unknown)=>void> = {};
  const show = vi.fn().mockResolvedValue(undefined);
  runInNewContext(readFileSync("public/nexo-push-sw.js","utf8"), {URL,self:{location:{origin:"https://www.nexosubastas.com"},registration:{showNotification:show},addEventListener:(name:string,handler:(event:unknown)=>void)=>handlers[name]=handler}});
  let done: Promise<unknown> = Promise.resolve();
  handlers["push"]?.({data:{json:()=>({title:"NEXO",body:"Mensaje",path:"/operaciones/11111111-1111-4111-8111-111111111111",image:"https://www.nexosubastas.com/api/public/subastas/11111111-1111-4111-8111-111111111111/miniatura"})},waitUntil:(p:Promise<unknown>)=>done=p});
  await done;
  expect(show).toHaveBeenCalledWith("NEXO",expect.objectContaining({image:"https://www.nexosubastas.com/api/public/subastas/11111111-1111-4111-8111-111111111111/miniatura",icon:"/icons/icon-192.png"}));
});
it("only transient provider failures retry",()=>{
  for(const status of [null,408,429,500,503]) expect(retryPush(status)).toBe(true);
  for(const status of [400,401,403,404,410]) expect(retryPush(status)).toBe(false);
});