// No secrets or customer data in output. Independent of the worker execution path.
const secret=process.env.AVEROMIRA_OPERATIONS_MONITOR_SECRET;
if(!secret||secret.length<32)throw new Error('Monitor credential not provisioned');
const result=await fetch('https://averomira.com/api/internal/operations/status',{headers:{Authorization:`Bearer ${secret}`},redirect:'error',signal:AbortSignal.timeout(20000)});
if(!result.ok)throw new Error('Operations readiness/liveness check failed');
const status=await result.json();
if(status.healthy!==true||status.schemaVersion!==1)throw new Error('Worker is not live or schema is incompatible');
console.log('Operations readiness and independent liveness: PASS');
