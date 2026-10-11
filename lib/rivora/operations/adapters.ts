import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { extractRfqFromPdf } from "@/lib/rivora/openai-rfq";
import { extractPurchaseOrderFromPdf } from "@/lib/rivora/openai-po";
import { reconcilePurchaseOrder, type PurchaseOrderLineInput, type QuoteLineInput } from "@/lib/rivora/po-reconciliation";
import { validateOperationPdf } from "./document";
import { OperationError } from "./policy";
import { operationPricing,usageMicroUsd } from "./usage";
import { workerCall } from "./database";
import type { OperationJob,WorkerDependencies } from "./worker";

export function workerAdapters(signal:AbortSignal):WorkerDependencies {
 return {
  call:workerCall,
  async read(job) {
    if(job.input_ref!==`${job.organization_id}/${job.id}.pdf`) throw new OperationError("permission");
    const key=process.env.AVEROMIRA_OPERATION_STORAGE_KEY?.trim();
    if(!key) throw new OperationError("config");
    // Explicit, dedicated JWT role only; never reuse the service-role secret.
    try { const payload=JSON.parse(Buffer.from(key.split('.')[1],"base64url").toString()); if(payload.role!=="averomira_storage_reader" || !payload.exp || payload.exp<=Date.now()/1000) throw new Error(); } catch { throw new OperationError("config"); }
    const storage=createClient(getSupabaseConfig().url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>fetch(input,{...init,signal})}});
    const {data,error}=await storage.storage.from("operation-inputs").download(job.input_ref);
    if(error || !data) throw new OperationError("invalid_file");
    const bytes=new Uint8Array(await data.arrayBuffer());
    const checked=await validateOperationPdf(bytes);
    if(checked.hash!==job.input_hash || checked.size!==Number(job.metadata.size) || checked.pages!==Number(job.metadata.pages)) throw new OperationError("invalid_file");
    return new File([bytes],"document.pdf",{type:"application/pdf"});
  },
  pricing:(type)=>{if(!process.env.OPENAI_API_KEY?.trim()) throw new OperationError("config");return operationPricing(type);},
  async extract(job,file) {
    const pricing=operationPricing(job.type);
    if(!process.env.OPENAI_API_KEY?.trim()) throw new OperationError("config");
    const options={model:pricing.model,timeoutMs:30_000,maxOutputTokens:pricing.maxOutputTokens,signal};
    try {
      const result=job.type==="rfq_pdf_process" ? await extractRfqFromPdf(file,options) : await extractPurchaseOrderFromPdf(file,options);
      if(result.extraction.document_type!==(job.type==="rfq_pdf_process"?"rfq":"purchase_order")) throw new OperationError("invalid_extraction");
      return result as unknown as Record<string,unknown>;
    } catch(e) {
      // SDK status/network classes are kept for policy, raw text never logged.
      if(e instanceof Error && /invalid|malformed|no structured|could not find|line limit|Invalid quantity|neither a SKU/.test(e.message)) throw new OperationError("invalid_extraction");
      throw e;
    }
  },
  bill:(result,type)=>usageMicroUsd(result.usage as {input_tokens:number;output_tokens:number}|null,operationPricing(type)),
  reconcile(context) {
    const c=context as {purchaseOrder:Record<string,unknown>;quote:Record<string,unknown>;poLines:Record<string,unknown>[];quoteLines:(Record<string,unknown>&{product?:Record<string,unknown>;sourceLine?:Record<string,unknown>})[];unitMemory:Record<string,string>[]};
    const po:PurchaseOrderLineInput[]=c.poLines.map(l=>({id:String(l.id),lineNumber:Number(l.line_number),customerSku:l.customer_sku as string|null,manufacturerPartNumber:l.manufacturer_part_number as string|null,description:String(l.raw_description??""),quantity:Number(l.quantity),unit:l.unit as string|null,unitPrice:l.unit_price==null?null:Number(l.unit_price),lineTotal:l.line_total==null?null:Number(l.line_total)}));
    const quotes:QuoteLineInput[]=c.quoteLines.map(l=>({id:String(l.id),lineNumber:Number(l.line_number),sku:l.sku_snapshot as string|null,productSku:l.product?.sku as string|null,manufacturerPartNumber:l.product?.manufacturer_part_number as string|null,description:String(l.description_snapshot??l.product?.name??""),sourceCustomerSku:l.sourceLine?.customer_sku as string|null,sourceDescription:l.sourceLine?.raw_description as string|null,quantity:Number(l.quantity),unit:l.unit as string|null,unitPrice:Number(l.unit_price),discountPercent:Number(l.discount_percent??0),lineTotal:Number(l.line_total)}));
    const aliases=new Map(c.unitMemory.map(m=>[m.source_key,{memoryId:m.id,sourceUnit:m.source_value,targetUnit:m.target_value}]));
    const comparison=reconcilePurchaseOrder(po,quotes,{unitAliases:aliases});
    const header:string[]=[];
    if(String(c.purchaseOrder.currency).toUpperCase()!==String(c.quote.currency).toUpperCase()) header.push("currency_mismatch");
    const norm=(x:unknown)=>String(x??"").toLowerCase().replace(/[^a-z0-9]+/g,"");
    if(norm(c.purchaseOrder.quote_reference) && norm(c.quote.quote_number) && norm(c.purchaseOrder.quote_reference)!==norm(c.quote.quote_number)) header.push("quote_reference_mismatch");
    return {header,summary:{...comparison.summary,headerExceptionCount:header.length},lines:comparison.lines.map(l=>({po_line_id:l.poLineId,quote_line_id:l.quoteLineId,line_kind:l.lineKind,match_method:l.matchMethod,match_score:l.matchScore,exception_codes:l.exceptionCodes,review_status:l.reviewStatus,po_snapshot:l.poSnapshot,quote_snapshot:l.quoteSnapshot,memory_context:l.memoryContext}))};
  },
  async notification(job,source) {
    const from=process.env.AVEROMIRA_SUPPORT_FROM?.trim() || process.env.AVEROMIRA_QUOTE_FROM?.trim();
    const support=process.env.AVEROMIRA_SUPPORT_EMAIL?.trim() || process.env.AVEROMIRA_QUOTE_REPLY_TO?.trim();
    const to=job.type==="incident_notification" ? process.env.AVEROMIRA_OPERATIONS_ALERT_EMAIL?.trim() : source.authorType==="support" ? String(source.requesterEmail??"") : support;
    if(!from || !to || !process.env.RESEND_API_KEY?.trim()) throw new OperationError("config");
    const subject=job.type==="incident_notification"?"Averomira: tarkistettava operatiivinen poikkeama":`Averomira support #${source.ticketNumber}: ${source.subject}`;
    const text=job.type==="incident_notification" ? `Incident: ${source.incidentId}\nReason: ${source.code}\nhttps://averomira.com/app/settings/operations` : `Ticket: #${source.ticketNumber}\n\n${source.message}\n\nhttps://averomira.com/app/settings/support`;
    return {from,to:[to],subject,text,...(support?{reply_to:support}:{})};
  },
  async send(job,payload) {
    const key=process.env.RESEND_API_KEY?.trim();if(!key) throw new OperationError("config");
    const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json","Idempotency-Key":`avm-operation-${job.id}`},body:JSON.stringify(payload),signal});
    if(!response.ok) { if(response.status===429) throw new OperationError("provider_rate"); if(response.status>=500) throw new OperationError("provider_unavailable"); throw new OperationError("ambiguous_effect"); }
    const body=await response.json();if(typeof body.id!=="string") throw new OperationError("ambiguous_effect");return body.id;
  },
 };
}
