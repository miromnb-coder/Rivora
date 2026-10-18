"use client";
export type ConversationListItem={id:string;title:string;context_kind:string|null;context_record_id:string|null;last_activity_at:string;created_at:string};
export function CopilotHistoryPanel({locale,items,onOpen,onRename,onDelete,onClose}:{
 locale:"fi"|"en";items:ConversationListItem[];onOpen:(id:string)=>void;
 onRename:(id:string,title:string)=>void;onDelete:(id:string)=>void;onClose:()=>void;
}){
 const fi=locale==="fi";
 return <section className="ml-copilot-cx2-sheet" aria-label={fi?"Aiemmat keskustelut":"Conversation history"}>
  <header className="ml-copilot-cx2-sheet-head">
   <strong>{fi?"Aiemmat keskustelut":"Previous conversations"}</strong>
   <button type="button" onClick={onClose} aria-label={fi?"Sulje historia":"Close history"}>×</button>
  </header>
  {items.length===0?<p>{fi?"Ei vielä tallennettuja keskusteluja.":"No saved conversations yet."}</p>:
   <ul className="ml-copilot-cx2-list">{items.map(x=><li key={x.id} className="ml-copilot-cx2-item">
    <button type="button" onClick={()=>onOpen(x.id)}>
     <span>{x.title}</span>{x.context_kind?<small>{x.context_kind.toUpperCase()}</small>:null}
    </button>
    <button type="button" aria-label={(fi?"Nimeä: ":"Rename: ")+x.title} onClick={()=>{
     const title=window.prompt(fi?"Uusi otsikko":"New title",x.title);if(title?.trim())onRename(x.id,title.trim());
    }}>✎</button>
    <button type="button" aria-label={(fi?"Poista: ":"Delete: ")+x.title} onClick={()=>{
     if(window.confirm(fi?"Poistetaanko keskustelu pysyvästi?":"Permanently delete this conversation?"))onDelete(x.id);
    }}>×</button>
   </li>)}</ul>}
 </section>;
}
