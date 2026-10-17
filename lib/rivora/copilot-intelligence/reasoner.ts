// Pure Phase 6 evidence derivations; do not conflate historical and current memory.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function id(value:unknown):string|null {
 return typeof value==="string" && UUID.test(value) ? value.toLowerCase() : null;
}
export function assessMemoryTargets(
 atUse:unknown,current:unknown,selected:unknown,
):{snapshotVerified:boolean;currentChanged:boolean;selectedDiffers:boolean} {
 const historic=id(atUse), present=id(current), chosen=id(selected);
 return {snapshotVerified:historic!==null,
   currentChanged:historic!==null && present!==null && historic!==present,
   selectedDiffers:historic!==null && chosen!==null && historic!==chosen,
 };
}
// A status difference is not automatically an error: business status rules
// must remain explicit and not be inferred from lexical similarity.
export function compareRecordedStatuses(statuses:readonly string[]):
 "insufficient"|"same"|"different" {
 if(statuses.length<2)return "insufficient";
 const normalized=statuses.map(x=>x.trim());
 if(normalized.some(x=>!x||x.length>48))return "insufficient";
 return new Set(normalized).size>1?"different":"same";
}
