import type { Locale } from "@/lib/locale";

export function getSetupCopy(locale: Locale) {
  return locale === "fi" ? {
    kicker: "Pilotin käyttöönotto",
    title: "Vie uusi työtila tyhjästä ensimmäiseen lähetettyyn tarjoukseen.",
    description: "Nodra pitää pilotin polun selkeänä: yritystiedot → katalogi → tarjouspyyntö → tarkistettu tarjous.",
    readiness: "Pilotin valmius", coreSteps: "ydinvaihetta valmiina",
    customers: "asiakasta", products: "tuotetta", rfqs: "tarjouspyyntöä", quotes: "tarjousta",
    ready: "Pilotin työnkulku valmis", progress: "Käyttöönotto kesken",
    done: "Valmis", next: "Seuraava",
    monitoring: "Tuotannon valvonta", monitoringTitle: "Sovelluksen virhevalvonta on aktiivinen.",
    monitoringBody: "Odottamattomat sovellusvirheet tallennetaan työtilalle ja tuotannon runtime-lokeihin tutkimista varten.",
    active: "Aktiivinen", csv: "CSV-pohja", blank: "Tyhjä katalogipohja ↓",
    blankBody: "Oikeat sarakeotsikot valmiina omille tuotteillesi.",
    sample: "Esimerkkidata", sampleTitle: "Esimerkkikatalogi ↓",
    sampleBody: "Pieni turvallinen datasetti ensimmäisen tarjouspyynnön testaamiseen.",
    steps: [
      ["Yrityksen asetukset", "Lisää myyjän tiedot, logo, oletus-ALV ja tarjouksen voimassaolo.", "Tarkista asetukset", "Täydennä yrityksen asetukset"],
      ["Tuotekatalogi", "Aloita omalla CSV/XLSX-tiedostolla tai Nodran esimerkkipohjalla.", "Avaa katalogityökalut", "Tuo ensimmäinen katalogi"],
      ["Ensimmäinen tarjouspyyntö", "Käsittele PDF, CSV tai XLSX ja vahvista tuoteosumat ennen tarjousta.", "Käsittele uusi tarjouspyyntö", "Käsittele ensimmäinen tarjouspyyntö"],
      ["Ensimmäinen tarjous", "Ratkaise tarjouspyyntö, luo tarjous, hyväksy se ja valitse vastaanottaja.", "Avaa tarjoukset", "Jatka työnkulkua"],
    ],
  } : {
    kicker: "Pilot setup",
    title: "Get a new workspace from empty to first sent quote.",
    description: "Nodra keeps the pilot path explicit: company identity → catalogue → RFQ → reviewed quote.",
    readiness: "Pilot readiness", coreSteps: "core steps complete",
    customers: "customers", products: "products", rfqs: "RFQs", quotes: "quotes",
    ready: "Pilot workflow ready", progress: "Setup in progress",
    done: "Done", next: "Next",
    monitoring: "Production monitoring", monitoringTitle: "Application error monitoring is active.",
    monitoringBody: "Unexpected app errors are recorded for the workspace and also written to production runtime logs for investigation.",
    active: "Active", csv: "CSV template", blank: "Blank catalogue template ↓",
    blankBody: "Correct headers, ready for your own products.",
    sample: "Sample data", sampleTitle: "Sample catalogue ↓",
    sampleBody: "A small safe dataset for testing the first RFQ flow.",
    steps: [
      ["Company settings", "Add the seller details, logo, default VAT and quote validity used on every new quote.", "Review settings", "Complete company settings"],
      ["Product catalogue", "Start with your own CSV/XLSX or download Nodra’s sample/template files.", "View catalogue tools", "Import first catalogue"],
      ["First RFQ", "Process a PDF, CSV or XLSX and review uncertain product matches before quoting.", "Process another RFQ", "Process first RFQ"],
      ["First quote", "Resolve the RFQ, create the quote, approve it and select a customer contact for sending.", "Open quotes", "Continue workflow"],
    ],
  };
}

export function getMemoryCopy(locale: Locale) {
  return locale === "fi" ? {
    kicker: "Asiakaskohtainen muisti", title: "Jokainen vahvistettu korjaus muuttuu uudelleenkäytettäväksi asiakastiedoksi.",
    description: "Nodra tallentaa asiakkaan käyttämät tuotenimet deterministisiksi vastineiksi. Kun sama koodi palaa, aiempi ihmisen päätös voidaan käyttää uudelleen.",
    saved: "Tallennetut vastineet", aliases: "asiakaskohtaista aliasia", learned: "Opitut asiakkaat", language: "joilla tallennettua tuotekieltä",
    totalUses: "Käyttökerrat", applications: "vastineen käyttökertaa", reused: "Uudelleenkäytetyt", moreThanOnce: "käytetty useammin kuin kerran",
    mappings: "Opitut vastineet", listTitle: "Asiakkaan kieli → kanoninen tuote.", newest: "Uusimmat vahvistukset ensin",
    customer: "Asiakas", unknown: "Tuntematon asiakas", human: "Ihmisen vahvistama", customerLanguage: "Asiakkaan tuotekieli",
    noSku: "Ei asiakkaan SKU:ta", noDescription: "Ei tallennettua kuvausta", canonical: "Kanoninen tuote",
    unavailable: "Tuote ei saatavilla", mapped: "Linkitetty tuote", uses: "Käytöt", reusedLabel: "käytetty uudelleen", once: "opittu kerran",
    empty: "Muisti on vielä tyhjä", emptyTitle: "Asiakaskohtainen muisti kasvaa tarkistetuista tarjouspyynnöistä.",
    emptyBody: "Vahvista tuoteosuma RFQ Review -näkymässä ja pidä asiakkaalle muistaminen käytössä.",
    humanConfirms: "Ihminen vahvistaa", humanCopy: "Käyttäjä valitsee oikean katalogituotteen.",
    savedTitle: "Vastine tallennetaan", savedCopy: "Asiakkaan SKU tai ilmaisu linkitetään deterministisesti.",
    reuseTitle: "Seuraava pyyntö käyttää sitä", reuseCopy: "Tunnettu vastine ratkaistaan ennen fuzzy-mätsäystä.",
  } : {
    kicker: "Customer memory", title: "Every confirmed correction becomes reusable customer knowledge.",
    description: "Nodra stores customer-specific product language as deterministic mappings. When the same code returns, the previous human decision can be reused instead of searched again.",
    saved: "Saved mappings", aliases: "customer-specific aliases", learned: "Customers learned", language: "with saved product language",
    totalUses: "Total uses", applications: "mapping applications", reused: "Reused mappings", moreThanOnce: "used more than once",
    mappings: "Learned mappings", listTitle: "Customer language → canonical product.", newest: "Newest confirmations first",
    customer: "Customer", unknown: "Unknown customer", human: "Human confirmed", customerLanguage: "Customer language",
    noSku: "No customer SKU", noDescription: "No saved description", canonical: "Canonical product",
    unavailable: "Product unavailable", mapped: "Mapped product", uses: "Uses", reusedLabel: "reused", once: "learned once",
    empty: "No memory yet", emptyTitle: "Customer memory grows from reviewed RFQs.",
    emptyBody: "Confirm a product match in RFQ Review and keep remembering the mapping for this customer enabled.",
    humanConfirms: "Human confirms", humanCopy: "A reviewer chooses the correct catalogue product.",
    savedTitle: "Mapping is saved", savedCopy: "Customer-specific SKU or language is linked deterministically.",
    reuseTitle: "Next RFQ reuses it", reuseCopy: "The known mapping can resolve before fuzzy matching is needed.",
  };
}

export function getOnboardingCopy(locale: Locale) {
  return locale === "fi" ? {
    kicker: "Ensimmäinen työtila", title: "Luo Nodra-työtilasi.",
    body: "Työtila muodostaa tietoturvarajan asiakkaille, tuotekatalogille, tarjouspyynnöille ja opituille SKU-vastineille.",
    name: "Yrityksen / työtilan nimi", placeholder: "Esimerkki Teollisuus Oy", create: "Luo työtila",
  } : {
    kicker: "First workspace", title: "Create your Nodra workspace.",
    body: "This becomes the security boundary for customers, product catalogue, RFQs and learned SKU mappings.",
    name: "Company / workspace name", placeholder: "Example Industrial Oy", create: "Create workspace",
  };
}

export function getSettingsCopy(locale: Locale) {
  return locale === "fi" ? {
    kicker: "Työtilan asetukset", title: "Yritystiedot, joita käytetään jokaisessa tarjouksessa.",
    description: "Näistä arvoista muodostuvat uusien tarjousten oletusasetukset ja myyjän tiedot asiakas-PDF:iin.",
    setup: "Pilotin käyttöönotto", saved: "Yrityksen asetukset tallennettu.", company: "Yrityksen nimi",
    businessId: "Y-tunnus / Business ID", optional: "valinnainen", email: "Yrityksen sähköposti", phone: "Puhelin",
    address: "Osoite", street: "Katuosoite", address2: "Osoiterivi 2 (valinnainen)", postal: "Postinumero", city: "Kaupunki",
    country: "Maa", vat: "Oletus ALV %", validity: "Tarjouksen voimassaolo (päivää)", logo: "Logo · PNG/JPEG, max 2 MB",
    save: "Tallenna yrityksen asetukset", permission: "Asetusten muokkaus vaatii owner- tai admin-oikeuden.",
    identity: "PDF-identiteetti", noLogo: "Logoa ei ole ladattu", noAddress: "Osoitetta ei ole asetettu",
    noEmail: "Sähköpostia ei ole asetettu", removeLogo: "Poista logo",
  } : {
    kicker: "Workspace settings", title: "Company details used on every quote.",
    description: "These values become the default commercial settings and seller identity in customer-facing PDFs.",
    setup: "Pilot setup", saved: "Company settings saved.", company: "Company name",
    businessId: "Y-tunnus / Business ID", optional: "optional", email: "Company email", phone: "Phone",
    address: "Address", street: "Street address", address2: "Address line 2 (optional)", postal: "Postal code", city: "City",
    country: "Country", vat: "Default VAT %", validity: "Quote validity (days)", logo: "Logo · PNG/JPEG, max 2 MB",
    save: "Save company settings", permission: "Owner or admin access is required to edit workspace settings.",
    identity: "PDF identity", noLogo: "No logo uploaded", noAddress: "Address not set",
    noEmail: "Email not set", removeLogo: "Remove logo",
  };
}
