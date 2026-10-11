import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { OperationError } from "./policy.ts";
export async function validateOperationPdf(bytes: Uint8Array) {
  if (bytes.length===0 || bytes.length>10*1024*1024 || Buffer.from(bytes.subarray(0,5)).toString("ascii")!=="%PDF-") throw new OperationError("invalid_file");
  let pages: number;
  try { pages=(await PDFDocument.load(bytes,{updateMetadata:false})).getPageCount(); } catch { throw new OperationError("invalid_file"); }
  if(pages<1 || pages>50) throw new OperationError("invalid_file");
  return {hash:createHash("sha256").update(bytes).digest("hex"),size:bytes.length,pages};
}
