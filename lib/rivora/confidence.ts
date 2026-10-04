export function extractionConfidencePercent(
  value: number | string | null | undefined,
): number | null {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  const percent = numeric >= 0 && numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, percent));
}

export function extractionConfidenceLabel(
  value: number | string | null | undefined,
) {
  const percent = extractionConfidencePercent(value);
  return percent == null ? null : `${Math.round(percent)}%`;
}

export function extractionConfidenceNeedsReview(
  value: number | string | null | undefined,
) {
  const percent = extractionConfidencePercent(value);
  return percent != null && percent < 60;
}
