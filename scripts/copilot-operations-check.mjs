#!/usr/bin/env node
// Offline aggregates only; this does not query real customer traffic.
import {readFileSync} from "node:fs";
import {assessCopilotHealth} from "../lib/rivora/copilot-release/metrics.ts";
if(!process.argv[2]){
 console.log("NO DATA: provide an approved, redacted aggregate JSON file; no live metrics queried.");
 process.exit(0);
}
try{
 const parsed=JSON.parse(readFileSync(process.argv[2],"utf8"));
 if(!Array.isArray(parsed.events)||parsed.events.length>100)throw Error("Invalid aggregate input");
 const report=assessCopilotHealth(parsed.events,Date.now());
 console.log(JSON.stringify(report,null,2));
 if(report.status!=="healthy")process.exitCode=1;
}catch{
 console.error("Invalid or unavailable aggregate metrics; monitoring status unknown.");
 process.exitCode=1;
}
