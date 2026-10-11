const secret=process.env.CRON_SECRET;
if(!secret||secret.length<32)throw new Error('Worker credential not provisioned');
const result=await fetch('https://averomira.com/api/internal/operations/tick',{headers:{Authorization:`Bearer ${secret}`},redirect:'error',signal:AbortSignal.timeout(60000)});
if(!result.ok)throw new Error('Bounded operations tick failed');
console.log('Bounded operations tick: accepted');
