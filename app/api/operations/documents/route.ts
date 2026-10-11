import { getAuthContext } from "@/lib/rivora/workspace";
import { operationsEnabled,DOCUMENT_TYPES } from "@/lib/rivora/operations/policy";
import { validateOperationPdf } from "@/lib/rivora/operations/document";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=30;
export async function POST(request:Request) {
 const headers={"Cache-Control":"private, no-store"};
 if(!operationsEnabled() || process.env.AVEROMIRA_DOCUMENT_QUEUE_ENABLED!=="true") return Response.json({error:"Taustakäsittely ei ole käytössä."},{status:503,headers});
 if(request.headers.get("origin")!==new URL(request.url).origin || request.headers.get("sec-fetch-site")==="cross-site") return Response.json({error:"Pyyntöä ei hyväksytty."},{status:403,headers});
 try {
  const c=await getAuthContext();if(!c.claims?.sub || !c.workspace) return Response.json({error:"Kirjaudu sisään."},{status:401,headers});
  const {data:identity,error:authError}=await c.supabase.auth.getUser();
  if(authError || identity.user?.id!==c.claims.sub || !["owner","admin","member"].includes(c.workspace.role)) return Response.json({error:"Käyttöoikeus puuttuu."},{status:403,headers});
  const input=await request.json();
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(String(input.operationId))) throw new Error();
  const org=c.workspace.id,id=String(input.operationId);
  if(input.phase==="begin") {
   if(!DOCUMENT_TYPES.includes(input.type)) throw new Error();
   const clean=(x:unknown)=>typeof x==="string"?x.trim().slice(0,200):"";
   const metadata={customerName:clean(input.customerName),reference:clean(input.reference),quoteId:clean(input.quoteId),fileName:clean(input.fileName)||"document.pdf"};
   if(metadata.quoteId && !/^[a-f0-9-]{36}$/i.test(metadata.quoteId)) throw new Error();
   if(metadata.quoteId) {
    const {data,error}=await c.supabase.from("quotes").select("id").eq("id",metadata.quoteId).eq("organization_id",org).in("status",["approved","sent"]).maybeSingle();
    if(error || !data) throw new Error();
   }
   const {data,error}=await c.supabase.rpc("begin_document_operation",{p_org:org,p_id:id,p_type:input.type,p_metadata:metadata});
   if(error || !data) throw new Error();
   const {data:upload,error:uploadError}=await c.supabase.storage.from("operation-inputs").createSignedUploadUrl(data.path,{upsert:false});
   if(uploadError || !upload) throw new Error();
   return Response.json({operationId:id,path:data.path,token:upload.token},{headers});
  }
  if(input.phase!=="finalize") throw new Error();
  const {data,error}=await c.supabase.storage.from("operation-inputs").download(`${org}/${id}.pdf`);
  if(error || !data) throw new Error();
  const checked=await validateOperationPdf(new Uint8Array(await data.arrayBuffer()));
  const {data:job,error:jobError}=await c.supabase.rpc("enqueue_document_operation",{p_org:org,p_id:id,p_hash:checked.hash,p_size:checked.size,p_pages:checked.pages});
  if(jobError || !job) throw new Error();
  return Response.json({jobId:job,statusUrl:`/api/operations/jobs/${job}`},{status:202,headers});
 }catch{return Response.json({error:"PDF-käsittelyä ei voitu hyväksyä. Tarkista tiedosto tai ota yhteys tukeen."},{status:409,headers});}
}
