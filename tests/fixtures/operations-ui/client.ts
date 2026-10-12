// Synthetic Storage boundary. This fixture has no hosted database credentials.
export function createClient(){return {storage:{from:()=>({uploadToSignedUrl:async(_path:string,_token:string,file:File)=>{const response=await fetch('/__fixture_storage',{method:'POST',body:file});return {error:response.ok?null:new Error('simulated upload response loss')};}})}};}
