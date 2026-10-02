export function getCanonicalAppUrl() {
  return (process.env.AVEROMIRA_APP_URL || "https://www.averomira.com").replace(/\/$/, "");
}
