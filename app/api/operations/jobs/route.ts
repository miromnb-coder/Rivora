import { getAuthContext } from "@/lib/rivora/workspace";
export const dynamic="force-dynamic";
export async function GET() {
 const headers={"Cache-Control":"private, no-store"};
 try {const c=await getAuthContext();if(!c.claims?.sub||!c.workspace)return Response.json({error:"Authentication required."},{status:401,headers});
 const {data,error}=await c.supabase.rpc("operation_status",{p_org:c.workspace.id});if(error)throw error;
 return Response.json({jobs:data},{headers});
 }catch{return Response.json({error:"Käsittelytilaa ei voitu hakea."},{status:503,headers});}
}
