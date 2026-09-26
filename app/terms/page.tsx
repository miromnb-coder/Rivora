import Link from "next/link";
import { getLocale } from "@/lib/locale";

export default async function TermsPage() {
  const locale = await getLocale();
  const fi = locale === "fi";

  const sections = fi
    ? [
        ["1. Soveltamisala", "Nämä ehdot koskevat Nodra-verkkosivun ja Nodra-palvelun käyttöä yritys- ja ammattikäytössä. Mahdollinen erillinen pilotointi-, tilaus- tai asiakassopimus on ensisijainen, jos se poikkeaa näistä yleisistä ehdoista."],
        ["2. Käyttöoikeus", "Palvelua saa käyttää vain siihen yritykseen tai organisaatioon liittyvä käyttäjä, jolle käyttöoikeus on myönnetty. Tunnuksia ei saa luovuttaa ulkopuolisille. Käyttäjä vastaa tunnustensa ja salasanansa asianmukaisesta suojaamisesta."],
        ["3. Palvelun käyttötarkoitus", "Nodra auttaa tarjouspyyntöjen jäsentämisessä, tuoterivien ratkaisemisessa, tarkistamisessa ja tarjousten valmistelussa. Käyttäjä vastaa aina lopullisten tuotetietojen, hintojen, verojen, ehtojen ja tarjousten oikeellisuuden tarkistamisesta ennen niiden lähettämistä asiakkaalle."],
        ["4. AI-avusteinen käsittely", "Palvelu voi käyttää AI-avusteisia toimintoja tietojen poimintaan ja jäsentämiseen. AI:n tuottamat tulokset voivat sisältää virheitä. Nodra on suunniteltu siten, että olennaiset tuotevalinnat voidaan tarkistaa ja vahvistaa ennen tarjouksen lähettämistä."],
        ["5. Asiakkaan aineisto", "Asiakas säilyttää oikeutensa palveluun toimittamaansa aineistoon. Asiakas vastaa siitä, että sillä on oikeus toimittaa ja käsitellä aineistoa Nodrassa. Nodra saa käsitellä aineistoa vain palvelun tuottamiseen, suojaamiseen ja sovitun tuen tarjoamiseen."],
        ["6. Saatavuus ja muutokset", "Palvelua kehitetään jatkuvasti, eikä keskeytyksetöntä tai täysin virheetöntä saatavuutta voida taata. Toimintoja voidaan muuttaa tai päivittää, kun se on tarpeen turvallisuuden, luotettavuuden tai tuotteen kehittämisen vuoksi."],
        ["7. Maksut ja pilottiehdot", "Pilotin hinta, kesto, laskutus, mahdollinen vähimmäisjakso ja muut kaupalliset ehdot määräytyvät verkkosivulla esitetyn tarjouksen ja/tai asiakkaan kanssa tehdyn kirjallisen sopimuksen perusteella. Kirjallinen asiakassopimus on ristiriitatilanteessa ensisijainen."],
        ["8. Kielletty käyttö", "Palvelua ei saa käyttää lainvastaiseen toimintaan, muiden oikeuksien loukkaamiseen, palvelun turvallisuuden kiertämiseen tai muiden käyttäjien tai järjestelmien vahingoittamiseen."],
        ["9. Vastuu", "Nodra on työväline, joka tukee käyttäjän tarjousprosessia. Asiakas vastaa liiketoimintapäätöksistään ja asiakkaalle lähettämistään tarjouksista. Mahdollisesta vastuunrajoituksesta sovitaan tarkemmin asiakas- tai pilotointisopimuksessa."],
        ["10. Yhteys", "Ehtoihin liittyvät kysymykset voi lähettää osoitteeseen miro@nodra.fi."],
      ]
    : [
        ["1. Scope", "These terms apply to use of the Nodra website and Nodra service for business and professional purposes. A separate pilot, order or customer agreement takes priority if it differs from these general terms."],
        ["2. Access", "The service may only be used by a user connected to the business or organization that has been granted access. Credentials may not be shared with outsiders. Users are responsible for protecting their account and password."],
        ["3. Intended use", "Nodra assists with structuring RFQs, resolving product lines, review and quote preparation. The user remains responsible for checking final product data, prices, taxes, terms and quotes before sending them to a customer."],
        ["4. AI-assisted processing", "The service may use AI-assisted functions to extract and structure information. AI-generated results may contain errors. Nodra is designed so that material product selections can be reviewed and confirmed before a quote is sent."],
        ["5. Customer content", "Customers retain their rights in content submitted to the service. Customers are responsible for having the right to submit and process that content in Nodra. Nodra may process customer content only to provide and secure the service and deliver agreed support."],
        ["6. Availability and changes", "The service is continuously developed and uninterrupted or error-free availability cannot be guaranteed. Features may be changed or updated where necessary for security, reliability or product development."],
        ["7. Fees and pilot terms", "Pilot pricing, duration, billing, any minimum term and other commercial terms are determined by the offer shown on the website and/or the written agreement with the customer. A written customer agreement takes priority in case of conflict."],
        ["8. Prohibited use", "The service may not be used for unlawful activity, infringement of others' rights, circumvention of service security, or harm to other users or systems."],
        ["9. Responsibility", "Nodra is a tool that supports the user's quoting process. The customer remains responsible for its business decisions and the quotes it sends to its customers. Any detailed limitation of liability is agreed in the customer or pilot agreement."],
        ["10. Contact", "Questions about these terms can be sent to miro@nodra.fi."],
      ];

  return (
    <main className="min-h-screen bg-white px-5 py-10 text-[#171a18]">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4 border-b border-[#e7e8e5] pb-6">
          <Link href="/" className="nodra-wordmark">NODRA</Link>
          <Link href="/" className="text-xs font-bold text-[#666c67] hover:text-[#171a18]">
            ← {fi ? "Etusivulle" : "Home"}
          </Link>
        </div>

        <header className="py-12">
          <div className="kicker">{fi ? "Ehdot" : "Terms"}</div>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-.045em] sm:text-5xl">
            {fi ? "Nodran käyttöehdot" : "Nodra terms of use"}
          </h1>
          <p className="mt-4 text-sm text-[#747975]">
            {fi ? "Päivitetty 26.9.2026" : "Updated 26 September 2026"}
          </p>
        </header>

        <div className="space-y-9 pb-16">
          {sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-7 text-[#5f6560]">{body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
