# P0-diagnostiikka: tietoturvakatselmointi ja julkaisuluvan rajaus

Katselmointi 11.10.2026. P0 BLOCKED. Tämä PR ei sisällä tuotantomigraatiota.

## Turvarajat

- Nykyinen Supabase SSR -asiakas varmentaa istunnon `auth.getUser()`-kutsulla.
  Vain Authin vahvistettu email ja nimenomainen `AVEROMIRA_SUPPORT_ADMIN_EMAILS`
  hyväksytään. Työtilan rooli, reply-to ja muokattava user_metadata eivät anna pääsyä.
- Production sekä Vercelin projekti `prj_69utcxbvaCPDSle5W3zptTa946rv` vaaditaan.
  Puuttuvat järjestelmämetatiedot tai allowlista sulkevat reitin ennen clientin luontia.
  Preview/development eivät voi suorittaa koetta.
- Reitti vanhenee 12.10.2026 klo 23.59 UTC. Myöhempi julkaisu tarvitsee uuden
  katselmoidun aikarajan; vanhentunutta reittiä ei julkaista.
- Sama `createAdminClient`-factory kuin nykyisessä health-reitissä suorittaa
  kiinteän HEAD `/rest/v1/organizations?select=id&limit=0` -lukupyynnön.
  Fetch-observer poimii vain onnistuneen todellisen pyynnön hostin projektitunnisteen.
  URL-asetuksen tai lähdekoodin fallbackin lukeminen ei yksin tuota tulosta.
- HTTPS ja vakioitu Supabase-host vaaditaan; redirectit, body, kirjoitusmetodit,
  vaihtoehtoiset polut, lisäparametrit ja duplikaattiparametrit kielletään.
  HTTP-pyyntö ei ota käyttäjältä mitään kohdeparametria. Asiakasrivejä ei palauteta.
- Tuloksessa vain projectRef, server-admin-konteksti, validoitu commit-SHA ja UTC-aika.
  Cache-Control private/no-store, Vary Cookie ja nosniff. Provider-virheet piilotetaan.
  Ei avainten, URL:ien, istuntojen tai dokumenttien lokitusta.
- Olemassa oleva admin-client käyttää olemassa olevaa palvelinavainta; uusi worker-rooli
  tai tietokantaoikeus ei ole tämän lyhyen lukutarkistuksen osa. Avainta ei palauteta.
  Supabase/hosting voivat kirjata tavallista pyynnön operatiivista metadataa.

## Todisteen täsmällinen merkitys

Tulos todistaa testatun diagnostiikkadeploymentin admin-clientin yhteyden.
Se ei yksin todista selaimen erillistä yhteyttä tai vanhan deploymentin yhteyttä.
Tallenna ennen julkaisua aktiivinen deployment-ID/commit sekä Supabase-URL-asetuksen
version metadata. Vertaa uuden deploymentin konfiguraatiota vanhaan yksityisesti.
Jos muuttumattomuutta ei voida osoittaa, vanhan deploymentin kytkentä pysyy tuntemattomana.
Muiden suoraan SQL-yhteyttä käyttävien asiakkaiden yhteyttä ei väitetä mitatuksi.

## Erilliset hyväksynnät, joita vielä tarvitaan

1. **Asetuslupa:** lukutarkistuksessa 11.10.2026 `AVEROMIRA_SUPPORT_ADMIN_EMAILS`
   puuttui Vercelin projektilta. Käyttäjän on nimettävä yksi olemassa olevan Averomira
   Supabase Auth -tilin vahvistettu sähköposti. Hyväksyttävä muutos on tämän muuttujan
   asettaminen vain Production-kohteeseen tähän osoitteeseen. Ei Preview-kohdetta,
   muita muuttujia, uusia avaimia, oikeusmuutoksia tai palvelutason muutosta.
   Muuttuja on myös nykyisen tukipalvelun operaattorin allowlista: samalla osoitteella
   on nykyisen operaattoritoiminnon pääsy. Tämä vaikutus kuuluu asetuslupaan.
2. **Julkaisulupa:** vasta vihreän CI:n ja nimetyn allowlistan jälkeen käyttäjä voi
   hyväksyä tämän PR:n täsmällisen SHA:n yhdistämisen ja normaalin Production-julkaisun
   kyseiseen Vercel-projektiin. Julkaisu sisältää rajatun diagnostiikan ja testidokumentit,
   ei tietokantamigraatiota, backup-vientiä, Phase 2A:ta tai palvelutason muutosta.
   Tarkistus tehdään ennen expiryä käyttäjän omalla Auth-istunnolla. Jos pipeline tai
   asetukset poikkeavat katselmoidusta, julkaisu pysäytetään uutta arviota varten.
3. **Poistojulkaisu:** todistuksen jälkeen reitti ja observer poistetaan erillisessä
   PR:ssä ja hyväksytyssä julkaisussa. Asetuksen poistamisesta tai säilyttämisestä
   tukipalvelulle sovitaan erikseen. Aikaraja ei poista koodia itsestään.

Tämä dokumentti ei myönnä mitään yllä olevista luvista. Tuotantomigraation lupa
pyydetään vasta runtime-, staging- ja palautusportin valmistuttua.
