#!/usr/bin/env node
// Read-only local operator helper. Does not create a backup or approve a release.
// Usage: node --experimental-strip-types scripts/copilot-release-preflight.mjs [manifest.json]
import {readFileSync} from "node:fs";
import {emptyReleaseManifest,evaluateCopilotRelease} from "../lib/rivora/copilot-release/readiness.ts";
const path=process.argv[2];
try {
 const input=path ? JSON.parse(readFileSync(path,"utf8")) : emptyReleaseManifest("");
 const result=evaluateCopilotRelease(input);
 process.stdout.write(JSON.stringify(result,null,2)+"\n");
 // NO_GO is expected until every human gate has been independently evidenced.
 // A malformed explicit manifest is an error; absent manifest is a safe report.
 if(path && result.decision!=="GO")process.exitCode=1;
} catch(error) {
 process.stderr.write("Invalid release evidence manifest. NO_GO.\n");
 process.exitCode=1;
}
