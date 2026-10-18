"use client";
export function CopilotConsentDialog({locale,onAllow,onSkip}:{
 locale:"fi"|"en";onAllow:()=>void;onSkip:()=>void;
}){
 const fi=locale==="fi";
 return <section className="ml-copilot-cx2-consent" role="group"
  aria-label={fi?"Työtilan tietojen käyttölupa":"Workspace data permission"}>
  <strong>{fi?"Sallitaanko työtilan tietojen käyttö?":"Allow workspace data?"}</strong>
  <p>{fi?"Copilot voi hakea yritystietoja ja lähettää rajattuja tietoja AI-mallille. Voit perua luvan asetuksista.":
    "Copilot may send limited workspace data to the AI model. You can revoke permission in Settings."}</p>
  <div className="ml-copilot-cx2-consent-actions">
   <button type="button" onClick={onSkip}>{fi?"Ei nyt":"Not now"}</button>
   <button type="button" onClick={onAllow}>{fi?"Salli käyttö":"Allow access"}</button>
  </div>
 </section>;
}
