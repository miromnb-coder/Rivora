import { getAuthContext } from "@/lib/rivora/workspace";
export const dynamic="force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
 const headers={"Cache-Control":"private, no-store"};
 try {const {id}=await params;if(!/^[a-f0-9-]{36}$/i.test(id))throw new Error();
 const c=await getAuthContext();if(!c.claims?.sub||!c.workspace)return Response.json({error:"Authentication required."},{status:401,headers});
 const {data,error}=await c.supabase.rpc("operation_status",{p_org:c.workspace.id,p_id:id});if(error)throw error;
 if(!data?.length)return Response.json({error:"Not found."},{status:404,headers});
 return Response.json({job:data[0]},{headers});
 }catch{return Response.json({error:"Käsittelytilaa ei voitu hakea."},{status:503,headers});}
}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}) {
 const headers={"Cache-Control":"private, no-store"};
 if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({error:"Forbidden."},{status:403,headers});
 try {const {id}=await params;const body=await request.json();if(!["cancel","retry"].includes(body.action))throw new Error();
 const c=await getAuthContext();if(!c.claims?.sub||!c.workspace)return Response.json({error:"Authentication required."},{status:401,headers});
 const {error}=await c.supabase.rpc("operation_control",{p_org:c.workspace.id,p_id:id,p_action:body.action});if(error)throw error;
 return Response.json({ok:true},{headers});
 }catch{return Response.json({error:"Toimenpidettä ei voitu tehdä."},{status:409,headers});}
}
