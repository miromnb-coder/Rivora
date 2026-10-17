// Isolated browser fixture: NO environment credentials, AI calls, business records or DB.
import { build } from "esbuild";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const bundle = await build({
  entryPoints: ["tests/fixtures/copilot-ui/entry.tsx"],
  bundle: true, write: false, format: "iife", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"test"' },
  alias: { "next/navigation": resolve("tests/fixtures/copilot-ui/navigation.ts") },
});
const styles = (await Promise.all([
  "styles/minimal-linen.css",
  "app/app/workspace-shell.css",
  "app/app/copilot-conversation.css",
].map(file => readFile(file, "utf8")))).join("\n");
const count = new Map();
let contextMode = false;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const event = data => "event: " + data.type + "\ndata: " + JSON.stringify(data) + "\n\n";

async function respond(req, res) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 12000) { res.writeHead(413); res.end(); return; }
  }
  let question = "";
  let optedIn = false;
  try {
    const payload=JSON.parse(raw);
    question=payload.question||"";
    optedIn=payload.useWorkspaceData===true;
  } catch { /* Synthetic invalid payload */ }
  if (question.includes("POIS")) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Copilot is not yet enabled in this environment." }));
    return;
  }
  const times = (count.get(question) || 0) + 1;
  count.set(question, times);
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    "X-Accel-Buffering": "no",
  });
  const send = data => { if (!res.destroyed) res.write(event(data)); };
  if (question.includes("JASENNYS")) {
    send({type:"stage",stage:"responding"});
    send({type:"delta",text:"Tarjouspyyntö vaatii yhden rivin tarkistusta.\n\nRivit\n- Rivi 1: vahvistettu\n"});
    await delay(20);
    send({type:"delta",text:"- Rivi 2: tuoteosuma puuttuu\n\nSeuraavaksi\nValitse sopiva tuote. <script>alert(1)</script>"});
    send({type:"done"});
    res.end();
    return;
  }
  if (contextMode && optedIn && question.includes("HAVAINNOT")) {
    const id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    send({type:"stage",stage:"retrieving"});
    send({type:"stage",stage:"responding"});
    send({type:"delta",text:"Tämä RFQ vaatii tarkistuksen."});
    const source={sourceId:"rfq:"+id,kind:"rfq",recordId:id,
      href:"/app/orders/case/rfq/"+id,label:"QA-RFQ-001"};
    send({type:"sources",sources:[source],truncated:false});
    send({type:"findings",kind:"rfq_review",partial:true,
      inspectedCount:2,totalCount:5,findings:[{
      id:"RFQ_LINE_UNMATCHED:2",code:"RFQ_LINE_UNMATCHED",severity:"high",
      sourceId:"rfq:"+id,title:"Rivi 2: tuoteosuma puuttuu",
      explanation:"Rivin 2 tallennetun tilan perusteella.",
      suggestedAction:"Valitse sopiva tuote käsin",
    }]});
    if(question.includes("KESKEN")){res.end();return;}
    if(question.includes("VIRHE")){send({type:"error",message:"Synthetic error"});res.end();return;}
    send({type:"done"});
    res.end();
    return;
  }
  if (contextMode && optedIn && question.includes("KONTEKSTI")) {
    send({type:"stage",stage:"retrieving"});
    await delay(15);
    send({type:"stage",stage:"verifying"});
    send({type:"stage",stage:"responding"});
    send({type:"delta",text:"Synteettinen tilausasia: QA-TEST-1"});
    send({type:"sources",sources:[{
      sourceId:"rfq:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      kind:"rfq",recordId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      label:"QA-TEST-1",
      href:"/app/orders/case/rfq/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }],truncated:false});
    send({type:"done"});
    res.end();
    return;
  }
  // Fragment even the SSE event boundary, without any real model calls.
  const beginning = Buffer.from(event({ type: "stage", stage: "connecting" }), "utf8");
  if (!res.destroyed) res.write(beginning.subarray(0, 5));
  await delay(12);
  if (!res.destroyed) res.write(beginning.subarray(5));
  await delay(25);
  send({ type: "stage", stage: "responding" });
  if (question.includes("PYSÄYTYS")) {
    send({ type: "delta", text: "Alku" });
    await delay(2500);
    send({ type: "delta", text: " jatkuu" });
    send({ type: "done" });
  } else if (question.includes("VIRHE") && times === 1) {
    send({ type: "delta", text: "Kesken jäänyt vastaus" });
    await delay(60);
    send({ type: "error", message: "Synteettinen virhe" });
  } else if (question.includes("KESKEN")) {
    send({ type: "delta", text: "Osittainen vastaus" });
    await delay(20);
    if (!res.destroyed) res.end();
    return;
  } else {
    // Split the UTF-8 emoji across writes.
    const part = Buffer.from(event({ type: "delta", text: "Testivastaus: " + question + " 💡" }));
    const split = part.indexOf(Buffer.from("💡")) + 2;
    if (!res.destroyed) res.write(part.subarray(0, split));
    await delay(20);
    if (!res.destroyed) res.write(part.subarray(split));
    await delay(20);
    send({ type: "done" });
  }
  if (!res.destroyed) res.end();
}

http.createServer(async (req, res) => {
  if (req.url === "/__reset" && req.method === "POST") {
    count.clear();
    contextMode=false;
    res.writeHead(204); res.end();
  } else if (req.url === "/__context_on" && req.method === "POST") {
    contextMode=true;
    res.writeHead(204);res.end();
  } else if (req.url === "/api/copilot/status" && req.method === "GET") {
    res.writeHead(200,{"Content-Type":"application/json","Cache-Control":"no-store"});
    res.end(JSON.stringify({
      available:contextMode,pilot:contextMode,contextAvailable:contextMode,
    }));
  } else if (req.url?.startsWith("/api/copilot/stream") && req.method === "POST") {
    try { await respond(req, res); }
    catch { if (!res.writableEnded) { res.writeHead(500); res.end(); } }
  } else if (req.url === "/bundle.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(bundle.outputFiles[0].text);
  } else if (req.url === "/style.css") {
    res.setHeader("Content-Type", "text/css");
    res.end(styles);
  } else {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end('<!doctype html><html lang="fi"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><main id="root"></main><script src="/bundle.js"></script></html>');
  }
}).listen(3200, "127.0.0.1");
