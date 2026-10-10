import type { CatalogueIssue } from "./catalogue-fields.ts";

// Keep every HTTP response below the hosted Function ceiling, including escaped
// Unicode source values. The browser joins report pages into one download.
const RESPONSE_BUDGET = 2 * 1024 * 1024;
export function catalogueIssueSample(issues: CatalogueIssue[]) {
  const sample: CatalogueIssue[] = [];
  let bytes = 2;
  for (const issue of issues.slice(0, 500)) {
    const size = Buffer.byteLength(JSON.stringify(issue)) + 1;
    if (bytes + size > RESPONSE_BUDGET) break;
    sample.push(issue);
    bytes += size;
  }
  return sample;
}

export function catalogueReportPage(issues: CatalogueIssue[], offset: number) {
  if (!Number.isInteger(offset) || offset < 0 || offset > issues.length)
    throw new Error("Virheellinen virheraportin sivu.");
  const cell = (value: unknown) =>
    '"' +
    String(value)
      .replace(/^[=+\-@\t\r]/, "'$&")
      .replace(/"/g, '""') +
    '"';
  let csv =
    offset === 0
      ? "\ufeffRivi;Sarake;Alkuperäinen arvo;Virhesyy;Korjaus\r\n"
      : "";
  let bytes = Buffer.byteLength(csv),
    next = offset;
  while (next < issues.length) {
    const issue = issues[next];
    const line =
      [issue.row, issue.column, issue.value, issue.reason, issue.correction]
        .map(cell)
        .join(";") + "\r\n";
    const size = Buffer.byteLength(line);
    if (bytes + size > RESPONSE_BUDGET) break;
    csv += line;
    bytes += size;
    next++;
  }
  if (next === offset && next < issues.length)
    throw new Error("Virheraportin yksittäinen rivi ylittää kokorajan.");
  return { csv, nextOffset: next < issues.length ? next : null };
}
