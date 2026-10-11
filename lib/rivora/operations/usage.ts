import { OperationError } from "./policy.ts";
export type Pricing = { model: string; version: string; inputUsdPerMillion: number; outputUsdPerMillion: number; reservationMicroUsd: number; maxOutputTokens: number };
export function operationPricing(type: string, env: Record<string,string|undefined> = process.env): Pricing {
  // No invented provider prices or customer contract budgets. Explicit reviewed configuration.
  let value: Pricing;
  try { value = JSON.parse(env.AVEROMIRA_AI_PRICING_JSON ?? "")[type]; } catch { throw new OperationError("config"); }
  if (!value || !value.model || !value.version || !Number.isFinite(value.inputUsdPerMillion) || value.inputUsdPerMillion<0 || !Number.isFinite(value.outputUsdPerMillion) || value.outputUsdPerMillion<0 || !Number.isSafeInteger(value.reservationMicroUsd) || value.reservationMicroUsd<=0 || !Number.isSafeInteger(value.maxOutputTokens) || value.maxOutputTokens<1 || value.maxOutputTokens>32000) throw new OperationError("config");
  return value;
}
export function usageMicroUsd(usage: {input_tokens?: number;output_tokens?: number} | null, pricing: Pricing) {
  if (!usage || !Number.isSafeInteger(usage.input_tokens) || !Number.isSafeInteger(usage.output_tokens) || usage.input_tokens!<0 || usage.output_tokens!<0) throw new OperationError("ambiguous_effect");
  const cost = Math.ceil(usage.input_tokens! * pricing.inputUsdPerMillion + usage.output_tokens! * pricing.outputUsdPerMillion);
  if (!Number.isSafeInteger(cost) || cost<0) throw new OperationError("ambiguous_effect");
  return cost;
}
