import { timingSafeEqual } from "node:crypto";
export function internalAuthorized(request:Request,secret:string|undefined) {
  if(!secret || secret.length<32) return false;
  const actual=Buffer.from(request.headers.get("authorization")??"");
  const expected=Buffer.from(`Bearer ${secret}`);
  return actual.length===expected.length && timingSafeEqual(actual,expected);
}
