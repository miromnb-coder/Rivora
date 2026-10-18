"use client";
export function CopilotSettingsMenu({locale,consent,historyEnabled,onConsent,onHistory,onClose,busy}:{
 locale:"fi"|"en";consent:boolean;historyEnabled:boolean;onConsent:(v:boolean)=>void;
 onHistory:(v:boolean)=>void;onClose:()=>void;busy?:boolean;
}){
 const fi=locale==="fi";
 return <section className="ml-copilot-cx2-sheet" aria-label={fi?"Copilotin asetukset":"Copilot settings"}>
  <header className="ml-copilot-cx2-sheet-head"><strong>{fi?"Copilotin asetukset":"Copilot settings"}</strong>
   <button type="button" onClick={onClose} aria-label={fi?"Sulje":"Close"}>×</button></header>
  <label className="ml-copilot-cx2-setting"><span><strong>{fi?"Työtilan tietojen käyttö":"Use workspace data"}</strong>
   <small>{fi?"Sallii rajattujen yritystietojen lähettämisen AI-mallille.":"Allow scoped workspace data to be sent to the AI model."}</small></span>
   <input type="checkbox" checked={consent} disabled={busy} onChange={e=>onConsent(e.target.checked)}/></label>
  <label className="ml-copilot-cx2-setting"><span><strong>{fi?"Tallenna keskusteluhistoria":"Save conversation history"}</strong>
   <small>{fi?"Voit jatkaa keskustelua myöhemmin.":"Resume past conversations later."}</small></span>
   <input type="checkbox" checked={historyEnabled} disabled={busy} onChange={e=>onHistory(e.target.checked)}/></label>
 </section>;
}
