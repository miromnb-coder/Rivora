import Link from "next/link";
import { getLocale } from "@/lib/locale";

export default async function PrivacyPage() {
  const locale = await getLocale();
  const fi = locale === "fi";

  const sections = fi
    ? [
        ["1. Rekisterinpitäjä ja yhteys", "Nodra käsittelee palveluun ja verkkosivuun liittyviä henkilötietoja. Tietosuojaa koskevissa asioissa voit ottaa yhteyttä osoitteeseen miro@nodra.fi."],
        ["2. Mitä tietoja käsittelemme", "Voimme käsitellä yhteystietoja, yritys- ja työroolitietoja, kirjautumis- ja käyttäjätilitietoja, palvelun käyttöön liittyviä teknisiä tietoja sekä sisältöä, jonka käyttäjä toimittaa palveluun, kuten tarjouspyyntöjä, asiakas- ja tuotetietoja."],
        ["3. Miksi tietoja käsitellään", "Tietoja käytetään palvelun toimittamiseen, käyttäjätilien hallintaan, pilotin ja asiakassuhteen hoitamiseen, viestintään, tietoturvaan, virheiden selvittämiseen ja palvelun kehittämiseen. Käsittely perustuu tilanteesta riippuen sopimukseen, sopimusta edeltäviin toimiin tai oikeutettuun etuun."],
        ["4. Palveluntarjoajat", "Nodra käyttää palvelun toteuttamisessa ulkopuolisia teknisiä palveluntarjoajia esimerkiksi hostingiin, tietokantaan ja tunnistautumiseen, sähköpostien toimitukseen sekä AI-avusteiseen käsittelyyn. Näihin voivat kuulua Vercel, Supabase, Resend ja OpenAI. Palveluntarjoajille annetaan vain palvelun tuottamiseen tarvittavia tietoja."],
        ["5. Säilytys", "Tietoja säilytetään vain niin kauan kuin se on tarpeen palvelun, asiakassuhteen, lakisääteisten velvoitteiden tai perusteltujen tietoturva- ja virheenselvitystarpeiden vuoksi. Tarpeettomat tiedot poistetaan tai anonymisoidaan kohtuullisessa ajassa."],
        ["6. Tietojen sijainti ja siirrot", "Tietoja pyritään käsittelemään EU/ETA-alueella, kun se on käytettyjen palveluiden osalta mahdollista. Jos tietoja siirretään ETA-alueen ulkopuolelle, käytetään soveltuvia suojatoimia, kuten EU:n vakiosopimuslausekkeita, kun niitä tarvitaan."],
        ["7. Oikeutesi", "Soveltuvan lain mukaan sinulla voi olla oikeus saada pääsy henkilötietoihisi, pyytää niiden oikaisua tai poistamista, rajoittaa käsittelyä, vastustaa käsittelyä ja saada tiedot siirrettyä. Voit myös tehdä valituksen toimivaltaiselle tietosuojaviranomaiselle."],
        ["8. Yritysasiakkaiden aineisto", "Kun Nodra käsittelee yritysasiakkaan palveluun tuomaa henkilötietoa asiakkaan puolesta, asiakas toimii lähtökohtaisesti rekisterinpitäjänä ja Nodra henkilötietojen käsittelijänä. Tarkemmat käsittelyehdot voidaan sopia erillisessä sopimuksessa tai tietojenkäsittelysopimuksessa."],
        ["9. Muutokset", "Tätä tietosuojakuvausta voidaan päivittää palvelun kehittyessä tai sääntelyn muuttuessa. Olennaiset muutokset merkitään tälle sivulle."],
      ]
    : [
        ["1. Controller and contact", "Nodra processes personal data related to the service and website. For privacy questions, contact miro@nodra.fi."],
        ["2. Data we process", "We may process contact details, company and job-role information, account and authentication information, technical usage data, and content users submit to the service, such as RFQs, customer information and product data."],
        ["3. Why we process data", "Data is used to provide the service, manage accounts, operate pilots and customer relationships, communicate with users, protect security, investigate errors and improve the service. Depending on the situation, processing is based on a contract, steps taken before entering a contract, or legitimate interests."],
        ["4. Service providers", "Nodra uses technical service providers for hosting, database and authentication, email delivery and AI-assisted processing. These may include Vercel, Supabase, Resend and OpenAI. Providers receive only the data needed to deliver the relevant service."],
        ["5. Retention", "We keep data only as long as needed for the service, customer relationship, legal obligations, or justified security and troubleshooting needs. Unneeded data is deleted or anonymized within a reasonable period."],
        ["6. Data location and transfers", "Where supported by the services used, data is processed in the EU/EEA. Where data is transferred outside the EEA, appropriate safeguards such as the EU Standard Contractual Clauses are used when required."],
        ["7. Your rights", "Under applicable law, you may have rights to access, correct or delete your personal data, restrict or object to processing, and receive portable data. You may also lodge a complaint with the competent data protection authority."],
        ["8. Customer data", "Where Nodra processes personal data submitted by a business customer on that customer's behalf, the customer generally acts as controller and Nodra as processor. More detailed processing terms may be agreed in a separate agreement or data processing agreement."],
        ["9. Changes", "This privacy notice may be updated as the service develops or legal requirements change. Material changes will be reflected on this page."],
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
          <div className="kicker">{fi ? "Tietosuoja" : "Privacy"}</div>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-.045em] sm:text-5xl">
            {fi ? "Tietosuojakuvaus" : "Privacy notice"}
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
