"use client";
import { useRef,useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { OperationQueue } from "./OperationQueue";
export function DocumentIntake({fi,type,quotes=[]}:{fi:boolean;type:"rfq_pdf_process"|"po_pdf_process";quotes?:{id:string;label:string}[]}) {
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(""),[jobId,setJobId]=useState<string>();
 const operation=useRef<string|null>(null),uploaded=useRef(false),startedMetadata=useRef<Record<string,string>|null>(null);
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);const file=form.get("pdf");if(!(file instanceof File)||file.size===0)return;
 setBusy(true);setMessage(fi?"Vastaanotetaan tiedostoa…":"Receiving document…");
 try {
 if(file.size>10*1024*1024)throw new Error();operation.current??=crypto.randomUUID();
 const post=async(body:unknown)=>{const res=await fetch("/api/operations/documents",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});if(!res.ok)throw new Error();return res.json();};
 if(!uploaded.current){
 const metadata={customerName:String(form.get("customerName")??""),reference:String(form.get("reference")??""),quoteId:String(form.get("quoteId")??""),fileName:file.name};startedMetadata.current??=metadata;
 const begin=await post({phase:"begin",operationId:operation.current,type,...startedMetadata.current});
 const {error}=await createClient().storage.from("operation-inputs").uploadToSignedUrl(begin.path,begin.token,file,{contentType:"application/pdf",upsert:false});if(error)throw error;uploaded.current=true;
 }
 const accepted=await post({phase:"finalize",operationId:operation.current});setJobId(accepted.jobId);setMessage(fi?"Työ vastaanotettu. Voit sulkea selaimen.":"Job accepted. You may close the browser.");
 }catch{setMessage(fi?"Käsittelyn hyväksyntää ei voitu vahvistaa. Yritä samalla tiedostolla uudelleen; jo hyväksytty työ säilyy.":"Acceptance could not be confirmed. Retry with the same file; an accepted job remains saved.");}finally{setBusy(false);}}
 return <div><form onSubmit={submit} className="upload-v2-form">
 {type==="po_pdf_process"?<label><span>{fi?"Linkitä tarjoukseen":"Link to quote"}</span><select name="quoteId"><option value="">{fi?"Ei valittua tarjousta":"No quote selected"}</option>{quotes.map(q=><option key={q.id} value={q.id}>{q.label}</option>)}</select></label>:null}
 <div className="upload-v2-fields"><label><span>{fi?"Asiakkaan nimi (valinnainen)":"Customer name (optional)"}</span><input name="customerName" maxLength={200}/></label><label><span>{fi?"Viite (valinnainen)":"Reference (optional)"}</span><input name="reference" maxLength={200}/></label></div>
 <label><span>{fi?"PDF-tiedosto · enintään 10 MB ja 50 sivua":"PDF · max 10 MB and 50 pages"}</span><input type="file" name="pdf" accept="application/pdf,.pdf" required disabled={busy||Boolean(jobId)}/></label>
 <button className="upload-v2-primary-btn" disabled={busy||Boolean(jobId)}>{busy?(fi?"Vastaanotetaan…":"Receiving…"):(fi?"Lähetä käsiteltäväksi":"Submit for processing")}</button><p role="status" aria-live="polite">{message}</p>
 </form>{jobId?<OperationQueue fi={fi} jobId={jobId}/>:null}</div>;
}
