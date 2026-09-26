export function getCanonicalAppUrl() {
  return (process.env.NODRA_APP_URL || "https://www.nodra.fi").replace(/\/$/, "");
}
