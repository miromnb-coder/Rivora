import { looksLikeSupportSecret } from "./support-ai";

export type EscalationEntry = {
  role: "user" | "assistant";
  text: string;
  path?: string;
  requestId?: string;
};

// Only prefill an editable form: never transmit an AI conversation automatically.
export function supportEscalationDraft(
  entries: readonly EscalationEntry[],
  path: string,
  locale: "fi" | "en",
): { subject: string; body: string; omitted: number } {
  const fi = locale === "fi";
  const allowed = entries.filter(item => item.path === path).slice(-6);
  const safe = allowed.filter(item => !looksLikeSupportSecret(item.text) &&
    !/\bBearer\s+[A-Za-z0-9+/_\-.]{10,}/i.test(item.text));
  const omitted = allowed.length - safe.length;
  const lastUser = [...safe].reverse().find(item => item.role === "user");
  const subject = lastUser
    ? "Support AI: " + lastUser.text.replace(/\s+/g, " ").slice(0, 140)
    : (fi ? "Support AI -kysymys vaatii tarkistuksen" : "Support AI question needs review");
  const discussion = safe.map(item =>
    (item.role === "user" ? (fi ? "Käyttäjä" : "User") : "Averomira AI") + ": " + item.text.slice(0, 900),
  ).join("\n\n");
  const requestId = [...safe].reverse().find(item => item.role === "assistant" && item.requestId)?.requestId;
  const body = [
    fi ? "Tarvitsen apua seuraavan keskustelun kanssa (tarkista sisältö ennen lähettämistä):"
       : "I need help with the following conversation (review before submitting):",
    discussion || (fi ? "Kuvaile ongelma tähän." : "Describe your issue here."),
    omitted > 0
      ? (String(omitted) + (fi ? " mahdollisesti arkaluonteista viestiä jätettiin pois." : " potentially sensitive messages were omitted."))
      : "",
    requestId && /^[A-Za-z0-9._:-]{1,120}$/.test(requestId) ? "Support AI request: " + requestId : "",
  ].filter(Boolean).join("\n\n");
  return { subject: subject.slice(0, 160), body: body.slice(0, 5000), omitted };
}
