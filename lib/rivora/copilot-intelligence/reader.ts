// Phase 6 Product Memory + related business evidence.
// Uses ONLY authenticated Supabase JWT/RLS reads with explicit organization and
// record equality, never the privileged get_rfq_product_memory_explanations_server RPC.
import type { createClient } from "@/lib/supabase/server";
import { verifyContextMembership } from "../copilot-context/authorization.ts";
import { verifyActiveRecordAccess, isActiveRecordUuid } from "../copilot-context/active-record.ts";
import { safeContextText } from "../copilot-context/sanitize.ts";
import { ContextReadError,type ContextSource } from "../copilot-context/types.ts";
import { validatedPhase6Facts } from "./evidence.ts";
import { assessMemoryTargets,compareRecordedStatuses } from "./reasoner.ts";
import type { Phase6Intent,Phase6Evidence,EvidenceCode,EvidenceLevel } from "./types.ts";
type ScopedDb=Awaited<ReturnType<typeof createClient>>;
const RFQ_LINE_COLUMNS="id,line_number,selected_product_id,match_method,review_status";
const MAX_QUOTES=3,MAX_PO=2,MAX_SALES=2;
const iso=(value:unknown)=>typeof value==="string" && !Number.isNaN(Date.parse(value))
  ? new Date(value).toISOString() : null;
function obj(v:unknown):Record<string,unknown> {
  return v&&typeof v==="object"&&!Array.isArray(v) ? v as Record<string,unknown> : {};
}
function fail():never {throw new ContextReadError("COPILOT_PHASE6_EVIDENCE_UNAVAILABLE");}
function source(kind:ContextSource["kind"],id:string,label:string):ContextSource {
  if(!isActiveRecordUuid(id)) fail();
  const recordId=id.toLowerCase();
  return {kind,recordId,sourceId:kind+":"+recordId,
    label:safeContextText(label,90),href:"/app/orders/case/"+kind+"/"+recordId};
}
function boundedStatus(v:unknown):string {
  return typeof v==="string"?safeContextText(v,48):"unknown";
}
export async function readAuthorizedPhase6Evidence(args:{
  db:ScopedDb; actorId:string; organizationId:string; rfqId:string;
  intent:Phase6Intent; focusedLineNumber?:number; locale:"fi"|"en";signal:AbortSignal;
}):Promise<Phase6Evidence> {
  const {db,actorId,organizationId,rfqId,intent,focusedLineNumber,locale,signal}=args;
  if(signal.aborted || !isActiveRecordUuid(organizationId) || !isActiveRecordUuid(rfqId)) fail();
  if(focusedLineNumber!==undefined && (!Number.isSafeInteger(focusedLineNumber)||
    focusedLineNumber<1 || focusedLineNumber>100000)) fail();
  const controller=new AbortController();
  const abort=()=>controller.abort();
  signal.addEventListener("abort",abort,{once:true});
  const timer=setTimeout(abort,5000);
  try {
    if(signal.aborted) fail();
    await verifyContextMembership(db,actorId,organizationId,controller.signal);
    await verifyActiveRecordAccess(db,organizationId,{kind:"rfq",id:rfqId},controller.signal);
    const {data:root,error:rootError}=await db.from("rfqs")
      .select("id,reference,status,customer_id")
      .eq("organization_id",organizationId).eq("id",rfqId)
      .abortSignal(controller.signal).maybeSingle();
    if(rootError||!root||root.id.toLowerCase()!==rfqId.toLowerCase()||controller.signal.aborted)
      fail();
    const rootSource=source("rfq",rfqId,root.reference||"RFQ");
    const sources:ContextSource[]=[rootSource];
    const facts:Phase6Evidence["facts"]=[];
    const limitations:string[]=[];
    let partial=false;
    const fi=locale==="fi";
    const add=(code:EvidenceCode,sourceId:string,detail:string,verification:EvidenceLevel="verified_record")=>{
      if(facts.length>=12) {partial=true;return;}
      facts.push({factId:code+":"+(facts.length+1),code,sourceId,
        detail:safeContextText(detail,180),verification});
    };
    const note=(fiText:string,enText:string)=>{
      if(limitations.length<4)limitations.push(fi?fiText:enText);
      partial=true;
    };
    add("RFQ_STATUS",rootSource.sourceId,
      (fi?"Tarjouspyynnön tallennettu tila: ":"Recorded RFQ status: ")+boundedStatus(root.status));
    if(intent==="memory_provenance"){
      if(focusedLineNumber===undefined){
        add("MEMORY_ORIGIN_UNVERIFIED",rootSource.sourceId,
          fi?"Muistivastineen alkuperä vaatii yksilöidyn RFQ-rivin.":"Memory origin requires an explicit RFQ line.","incomplete_evidence");
        note("Anna rivinumero muistiselityksen tarkistamiseksi.","Specify the RFQ line number to check memory provenance.");
      }else{
        const {data:rows,error:lineError}=await db.from("rfq_lines")
          .select(RFQ_LINE_COLUMNS).eq("organization_id",organizationId).eq("rfq_id",rfqId)
          .eq("line_number",focusedLineNumber).limit(2).abortSignal(controller.signal);
        if(lineError || !Array.isArray(rows) || rows.length!==1 || controller.signal.aborted)fail();
        const line=rows[0];
        if(!isActiveRecordUuid(line.id)||line.line_number!==focusedLineNumber)fail();
        add("MEMORY_METHOD",rootSource.sourceId,
          (fi?"Rivin osumamenetelmä: ":"Recorded match method: ")+boundedStatus(line.match_method));
        const isMemory=["customer_memory","product_memory"].includes(String(line.match_method));
        if(isMemory){
          const {data:events,error:eventError}=await db.from("workspace_memory_usage_events")
            .select("id,memory_id,used_at,metadata")
            .eq("organization_id",organizationId)
            .eq("source_entity_type","rfq_line").eq("source_entity_id",line.id)
            .order("used_at",{ascending:false}).limit(6).abortSignal(controller.signal);
          if(eventError || !Array.isArray(events) || controller.signal.aborted)fail();
          if(events.length===0){
            add("MEMORY_USAGE_MISSING",rootSource.sourceId,
              fi?"Riviin liittyvää muistivastineen käyttötapahtumaa ei löytynyt.":"No memory usage event was found for this line.","incomplete_evidence");
            note("Pelkkä tallennettu menetelmä ei todista muistivastineen alkuperää.",
              "A stored match method alone does not prove memory provenance.");
          }else{
            if(events.length>5) note("Käyttöhistoria sisältää yli viisi tapahtumaa.","Usage history has more than five events.");
            // Only the most recent relevant event is explained; other events
            // cannot be conflated into a single claimed historical decision.
            const event=events[0];
            if(!isActiveRecordUuid(event.memory_id))fail();
            const {data:memory,error:memError}=await db.from("workspace_memory_entries")
              .select("id,customer_id,memory_type,verification_state,source,target_entity_id,verified_at")
              .eq("organization_id",organizationId).eq("id",event.memory_id)
              .abortSignal(controller.signal).maybeSingle();
            if(memError || controller.signal.aborted)fail();
            if(!memory || memory.memory_type!=="customer_sku_product" ||
              memory.customer_id!==root.customer_id){
              add("MEMORY_ORIGIN_UNVERIFIED",rootSource.sourceId,
                fi?"Käyttötapahtuman muistimerkintää ei voitu varmentaa nykyisestä työtilasta.":"The memory entry linked to the usage event could not be verified.","incomplete_evidence");
              note("Muistivastineen tarkkaa alkuperää ei voitu varmistaa.","Exact memory provenance could not be verified.");
            }else{
              const metadata=obj(event.metadata);
              const comparison=assessMemoryTargets(
                metadata.memory_target_entity_id,memory.target_entity_id,line.selected_product_id);
              const historicalValid=comparison.snapshotVerified;
              const time=iso(event.used_at);
              add("MEMORY_USAGE_FOUND",rootSource.sourceId,
                time ? (fi?"Muistivastinetta käytettiin: ":"Memory usage recorded: ")+time.slice(0,10)
                  : fi?"Muistivastineen käyttötapahtuma on tallennettu.":"A memory usage event is recorded.");
              const recordedSource=metadata.memory_source;
              if(typeof recordedSource==="string"&&recordedSource.length<=40)
                add("MEMORY_SOURCE_AT_USE",rootSource.sourceId,
                  (fi?"Tapahtumahetken lähdeluokka: ":"Recorded source at usage: ")+safeContextText(recordedSource,40));
              const verification=metadata.memory_verification_state;
              if(typeof verification==="string"&&verification.length<=40)
                add("MEMORY_VERIFIED_AT_USE",rootSource.sourceId,
                  (fi?"Tapahtumahetken vahvistustila: ":"Verification state at usage: ")+safeContextText(verification,40));
              if(historicalValid){
                 add("MEMORY_TARGET_AT_USE",rootSource.sourceId,
                  fi?"Tapahtumahetken kohdetuote on tallennettu tilannekuvaan.":"The product target at usage is recorded in an immutable snapshot.");
                if(comparison.currentChanged)
                  add("MEMORY_TARGET_CHANGED",rootSource.sourceId,
                    fi?"Muistivastineen nykyinen kohdetuote poikkeaa tapahtumahetken kohteesta.":"The current memory target differs from the historical target.",
                    "conflicting_evidence");
                if(comparison.selectedDiffers)
                  note("Rivin nykyinen valittu tuote poikkeaa muistin käyttötapahtuman kohteesta.",
                    "The RFQ line's current selected product differs from the usage-event target.");
              }else{
                add("MEMORY_ORIGIN_UNVERIFIED",rootSource.sourceId,
                  fi?"Historiallista kohdetuotetta ei ole varmennettu tilannekuvasta.":"The historical product target could not be verified from an event snapshot.",
                  "incomplete_evidence");
                note("Nykyistä muistivastinetta ei käytetä historiallisen kohteen todisteena.",
                  "The current memory entry is not evidence of the historical target.");
              }
            }
          }
        }else{
          add("MEMORY_ORIGIN_UNVERIFIED",rootSource.sourceId,
            fi?"Rivin tallennettu osumamenetelmä ei osoita muistiin perustuvaa osumaa.":"The stored method does not indicate a memory-based match.","incomplete_evidence");
        }
      }
    }else{
      const {data:quotes,error:quoteError}=await db.from("quotes")
        .select("id,status,customer_id,updated_at,rfq_id")
        .eq("organization_id",organizationId).eq("rfq_id",rfqId)
        .order("updated_at",{ascending:false}).order("id",{ascending:true})
        .limit(MAX_QUOTES+1).abortSignal(controller.signal);
      if(quoteError||!Array.isArray(quotes)||controller.signal.aborted)fail();
      if(quotes.length>MAX_QUOTES)note("Tarjouksia löytyi enemmän kuin haun enimmäismäärä.","Additional quotes exist beyond the selected sample.");
      const chosen=quotes.slice(0,MAX_QUOTES);
      if(chosen.length===0) add("RELATION_MISSING",rootSource.sourceId,
        fi?"Tähän RFQ:hun ei löytynyt liittyvää tarjousta rajatusta hausta.":"No related quote was found for this RFQ in the scoped search.");
      if(intent==="business_comparison" && chosen.length>1){
        if(compareRecordedStatuses(chosen.map(row=>boundedStatus(row.status)))==="different"){
          add("REVIEW_REQUIRED",rootSource.sourceId,
            fi?"Liittyvien tarjousten tallennetut tilat poikkeavat toisistaan. Tämä ei yksin osoita virhettä."
              :"Related quotes have different recorded statuses. This alone does not prove an error.",
            "deterministic_derivation");
        }
      }
      const ids:string[]=[];
      for(const row of chosen){
        if(!isActiveRecordUuid(row.id)||row.rfq_id!==root.id ||
          row.customer_id!==root.customer_id)fail();
        const node=source("quote",row.id,fi?"Tarjous":"Quote");sources.push(node);
        ids.push(row.id);
        add("QUOTE_STATUS",node.sourceId,(fi?"Tarjouksen tila: ":"Quote status: ")+boundedStatus(row.status));
      }
      if(ids.length){
        const {data:pos,error:poError}=await db.from("purchase_orders")
          .select("id,status,quote_id,customer_id,updated_at")
          .eq("organization_id",organizationId).in("quote_id",ids)
          .order("updated_at",{ascending:false}).order("id",{ascending:true})
          .limit(MAX_PO+1).abortSignal(controller.signal);
        if(poError||!Array.isArray(pos)||controller.signal.aborted)fail();
        if(pos.length>MAX_PO)note("Ostotilausketju on rajattu otos.","Purchase order relations are a partial sample.");
        for(const row of pos.slice(0,MAX_PO)){
          if(!isActiveRecordUuid(row.id)||!ids.includes(String(row.quote_id)) ||
            row.customer_id!==root.customer_id)fail();
          const node=source("po",row.id,fi?"Ostotilaus":"Purchase order");sources.push(node);
          add("PO_STATUS",node.sourceId,(fi?"Ostotilauksen tila: ":"Purchase order status: ")+boundedStatus(row.status));
        }
        const {data:sales,error:salesError}=await db.from("sales_order_drafts")
          .select("id,status,quote_id,customer_id,updated_at")
          .eq("organization_id",organizationId).in("quote_id",ids)
          .order("updated_at",{ascending:false}).order("id",{ascending:true})
          .limit(MAX_SALES+1).abortSignal(controller.signal);
        if(salesError||!Array.isArray(sales)||controller.signal.aborted)fail();
        if(sales.length>MAX_SALES)note("Myyntitilausluonnokset ovat rajattu otos.","Sales order drafts are a partial sample.");
        for(const row of sales.slice(0,MAX_SALES)){
          if(!isActiveRecordUuid(row.id)||!ids.includes(String(row.quote_id)) ||
            row.customer_id!==root.customer_id)fail();
          const node=source("sales",row.id,fi?"Myyntitilausluonnos":"Sales draft");sources.push(node);
          add("SALES_STATUS",node.sourceId,(fi?"Myyntitilausluonnoksen tila: ":"Sales draft status: ")+boundedStatus(row.status));
        }
      }
      note("Ulkoisen ERP-järjestelmän reaaliaikaista tilaa ei ole haettu.",
        "The external ERP's live status was not queried.");
    }
    if(controller.signal.aborted)fail();
    const result:Phase6Evidence={kind:intent,retrievedAt:new Date().toISOString(),
      facts,sources,partial,limitations};
    if(!validatedPhase6Facts(result))fail();
    return result;
  }finally{
    clearTimeout(timer);signal.removeEventListener("abort",abort);
  }
}
