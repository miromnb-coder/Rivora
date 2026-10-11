"use client";
import { useEffect,useState,useId } from "react";
import Link from "next/link";
import { safeJobReason,type JobState } from "@/lib/rivora/operations/policy";
export type JobSummary={id:string;type:string;state:JobState;stage:string;entity_id:string|null;error_code:string|null;updated_at:string;can_control:boolean};
const labels:Record<JobState,[string,string]>={queued:["Odottaa käsittelyä","Queued"],running:["Käsitellään","Processing"],retry_wait:["Odottaa uutta yritystä","Waiting to retry"],blocked:["Korjattavaa tietoa","Action required"],needs_review:["Valmis tarkistettavaksi","Needs review"],succeeded:["Valmis tarkistettavaksi","Ready to review"],dead:["Käsittely epäonnistui","Processing failed"],cancelled:["Peruttu","Cancelled"]};
export function OperationQueue({fi,jobId}:{fi:boolean;jobId?:string}) {
 const headingId=useId();
 const [jobs,setJobs]=useState<JobSummary[]>([]),[error,setError]=useState(false),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState<string|null>(null);
 useEffect(()=>{
  let stopped=false,timer:ReturnType<typeof setTimeout>;
  const load=async()=>{
   try {const res=await fetch(jobId?`/api/operations/jobs/${jobId}`:"/api/operations/jobs",{cache:"no-store"});if(!res.ok)throw new Error();const body=await res.json();if(!stopped){setJobs(jobId?[body.job]:body.jobs);setError(false);setLoaded(true);}}
   catch{if(!stopped){setError(true);setLoaded(true);}}
   if(!stopped)timer=setTimeout(load,document.visibilityState==="visible"?5000:30000);
  };void load();return()=>{stopped=true;clearTimeout(timer);};
 },[jobId]);
 async function control(id:string,action:string){setBusy(id);try{const response=await fetch(`/api/operations/jobs/${id}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action})});if(!response.ok)throw new Error();}catch{setError(true);}finally{setBusy(null);}}
 return <section className="surface mt-6 p-6" aria-labelledby={headingId}>
 <h2 id={headingId} className="text-2xl font-bold">{fi?"Taustakäsittelyt":"Background processing"}</h2>
 <p className="mt-2 text-sm text-[var(--muted)]">{fi?"Hyväksytty käsittely jatkuu, vaikka suljet selaimen. Valmis aineisto tarkistetaan normaalissa työnkulussa.":"Accepted processing continues after you close the browser. Review the result in the normal workflow."}</p>
 <div role="status" aria-live="polite" className="mt-4">{!loaded?(fi?"Haetaan käsittelytilaa…":"Loading processing status…"):error?(fi?"Käsittelytilaa ei saatu. Taustakäsittelyn valmius vaatii tarkistuksen.":"Processing status is unavailable. Background processing readiness needs review."):jobs.length===0?(fi?"Ei taustakäsittelyitä.":"No background jobs."):null}</div>
 <ul aria-live="polite" className="mt-4 divide-y divide-[var(--line)]">{jobs.map(j=><li key={j.id} className="py-4 flex flex-wrap items-center justify-between gap-4">
 <div className="min-w-0"><strong>{j.type==="rfq_pdf_process"?"PDF RFQ":j.type==="po_pdf_process"?"PDF PO":fi?"Ilmoitus tai toimituksen tarkistus":"Notification or delivery review"}</strong><p className="text-sm">{labels[j.state]?.[fi?0:1]}</p>{safeJobReason(j.error_code,fi)?<p className="text-sm text-[var(--muted)]">{safeJobReason(j.error_code,fi)}</p>:null}<p className="text-xs break-all text-[var(--muted)]">{fi?"Käsittelytunniste":"Operation ID"}: {j.id}</p></div>
 <div className="flex flex-wrap gap-3">{j.entity_id?<Link className="font-semibold underline" href={j.type==="po_pdf_process"?`/app/purchase-orders/${j.entity_id}`:`/app/rfq/${j.entity_id}`}>{fi?"Avaa aineisto":"Open document"}</Link>:null}
 {j.can_control && !j.entity_id && ["queued","running","retry_wait","blocked"].includes(j.state)?<button className="rounded-lg border border-[var(--line)] px-3 py-2" disabled={busy===j.id} onClick={()=>control(j.id,"cancel")}>{fi?"Peru käsittely":"Cancel processing"}</button>:null}
 {j.can_control && ["blocked","dead"].includes(j.state) && ["config","budget","network","provider_rate","provider_unavailable","database"].includes(j.error_code??"")?<button className="rounded-lg border border-[var(--line)] px-3 py-2" disabled={busy===j.id} onClick={()=>control(j.id,"retry")}>{fi?"Yritä uudelleen":"Retry"}</button>:null}</div>
 </li>)}</ul></section>;
}
