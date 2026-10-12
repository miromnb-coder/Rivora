# Phase 2A — toteutus ja katselmointi

PR #105 on kehitystoteutus. Aktivointi, main-yhdistäminen ja tuotantomigraatiot vaativat erillisen hyväksynnän. P0:n BLOCKED-tila ei käyttäjän 11.10.2026 täsmennyksen jälkeen estä tätä kehitystyötä.

## Toteutettu arkkitehtuuri

PostgreSQL on operaatioiden auktoriteetti. Organisaation, työtyypin ja asiakkaan UUID-operaatioavaimen uniikkius estää kadonneen HTTP-vastauksen kaksoisjulkaisun. PDF ladataan allekirjoitetulla uploadilla yksityiseen, muuttumattomaan `operation-inputs`-bucketiin; palvelin tarkistaa bytes/hash/sivumäärän ennen enqueuea. Selaimen odottelua ei tarvita hyväksynnän jälkeen. Nykyiset suorat PDF-serveractionit suljetaan vain uuden dokumenttijonon aktivointikytkimen ollessa päällä.

Claim lukitsee globaalin kapasiteetin, tenant-rajan ja tehtävän tässä järjestyksessä. Claim käyttää `FOR UPDATE SKIP LOCKED`, monotonista generationia, satunnaista lease-tokenia ja 180 sekunnin leasea. Heartbeat on 20 sekuntia. Julkaisu, checkpoint ja finish edellyttävät edelleen voimassa olevaa leasea; myös NULL-token torjutaan. Käyttäjän nykyinen jäsenyys ja rooli tarkistetaan suorituksessa, ja julkaisu lukitsee jäsenyysrivin. Pitkäikäistä käyttäjä-JWT:tä ei tallenneta.

AI-vastaus, kustannus ja checkpoint tallennetaan samassa transaktiossa. RFQ/PO, rivit, AI-poiminta ja auditointi julkaistaan atomisesti samalla pysyvällä entiteetti-ID:llä. Tuotevastinehaku käyttää nykyistä vastinemuistia ja jättää ehdotukset ihmisen tarkistettaviksi. PO käyttää nykyistä determinististä vertailua ja kaupallisia lukkoja. Tekninen `succeeded` ei tarkoita tarjouksen, PO:n tai tuotevastineen hyväksymistä.

Työtyypit: PDF-RFQ, PDF-PO, tukiviesti-ilmoitus, incident-ilmoitus ja olemassa olevan tarjoussähköpostiyrityksen täsmäytys. ERP-vientejä tai tarjoussähköposteja ei lähetetä automaattisesti uudelleen. Tukiviestin AFTER INSERT -outbox ja viesti kuuluvat samaan transaktioon. Ilmoituksen vastaanottajat ja viesti jäädytetään ennen provider-kutsua; sama Resend-idempotenssiavain ja täsmälleen sama body säilyvät uusinnassa. 23 tunnin jälkeen epäselvä toimitus vaatii tarkistuksen.

## Rajat ja virheet

Workerin Node-endpointin `maxDuration=60` ja oma aikabudjetti 50 sekuntia ovat konservatiivisia. AI-kutsu 30 sekuntia, per-tehtävä abort 35 sekuntia, enintään kaksi claimia/tick ja yksi tenant-claim samalla worker-ajolla. Asetusta ei ole aktivoitu Vercelissä eikä 240 sekunnin runtimea oleteta.

Kolme yritystä, dokumentin kokonaisikä tunti, backoff 30/120/600 sekuntia ja jitter. PostgreSQL rajaa viiveen 600 sekuntiin. Väärä tiedosto ja pysyvä ohjelmistovirhe päätyvät deadiin. Oikeus, asetus ja budjetti blokkaavat. Vanhentuneesta leasesta palautuminen säilyttää checkpointin. AI-kutsun epäselvä veloitus säilyttää varatun kustannuksen; toisen epäselvän kutsun jälkeen tarvitaan ihmisen tarkistus. Kustannusasetukset ja SQL-rajojen oletukset ovat 0/fail-closed; testibudjetit eivät ole asiakkaiden sopimusehtoja.

Kuukausi- ja päiväkohtainen globaali + organisaatiovaraus tehdään atomisesti. Julkisella AI:lla on lisäksi erillinen järjestelmätason scope. Sama ledger koskee katalogin AI-kartoitusta, kirjautunutta tukitekoälyä ja julkista AI:ta erillisellä aktivointikytkimellä. Tokenit, mallin tunniste, hinnastoversio, varattu/toteutunut/epäselvä kulu tallentuvat ilman dokumentti- tai keskustelusisältöä. Todellinen provider-kulu voi ylittää väärin mitoitetun ennakkovarauksen; hinnasto, tokenkatot ja konservatiivinen varaus on siksi varmennettava ennen aktivointia. Ylitys säilytetään todellisena kuluna ja estää seuraavat varaukset.

Monitori ryhmittelee queue-, dead-, ERP-, email-, provider-, toistuvan sovellusvirheen ja budjettisignaalit. Dedupe, kaksi havaintoa, kahden puhtaan tarkistuksen hystereesi ja 24 tunnin cooldown rajoittavat ilmoituksia. Provider-parent vähentää jonon ja dead-tapausten ilmoitustulvaa. Normaalisti palautuvat tekniset virheet eivät sellaisenaan luo incidentiä. Shadow-mode ei claimaa, lähetä tai julkaise liiketoimintatuloksia. Se päivittää vain sisäisiä incident- ja worker-run-tietueita, joten myös tuotannon shadow vaatii luvan.

Seitsemän päivän jälkeen onnistuneiden/peruttujen/dead-tehtävien ylimääräiset checkpointit siivotaan rajatusti. Vanhentuneet katalogin preview-payloadit siivotaan, aggregaatit ja auditointi säilyvät. Varsinaisten PDF-objektien poistoa ei aktivoida: PO/RFQ:n lähdeaineiston säilytyspolitiikka ja rajattu Storage-poistorooli vaativat erillisen varmennuksen. Orpojen uploadien määrä raportoidaan.

## Oikeudet ja ympäristöasetukset

`averomira_worker_login` on LOGIN-rooli ilman salasanaa migraation jälkeen. Erillinen hyväksytty provisiointi asettaa salasanan ja rajatun TLS/pooler-URL:n. Sillä on vain `averomira_worker`-roolin periytyvät RPC-oikeudet; synteettinen natiivitesti todentaa tämän. `averomira_worker`: NOLOGIN, ei BYPASSRLS:ää, DDL:ää, taulujen suoraa luku-/kirjoitusoikeutta tai yleistä service-rolea. Saa EXECUTE:n vain nimetyille worker-funktioille. `averomira_operations_owner`: NOLOGIN, yksityisten työtaulujen omistaja ja rajatut domain-taulujen oikeudet SECURITY DEFINER -funktioiden toteuttamiseksi. Funktioissa tyhjä search_path, tenant/entity-tarkistukset ja eksplisiittinen EXECUTE-revoke.

`averomira_storage_reader`: autentikaattori voi vaihtaa tähän rooliin vain rajatulla allekirjoitetulla JWT:llä; vain operation-inputs-objektien SELECT aktiiviseen job-leaseen sidotulla RLS:llä; ei INSERT/UPDATE/DELETE-oikeutta. Aidon Storage JWT -roolin, authenticator-roolin jäsenyyden, tokenin allekirjoituksen/kierron ja poolerin TLS-yhteyden toimivuus on vielä todistettava täydellisessä stagingissa. Service-role-fallbackia ei ole.

Tarvittavat asetukset, joista mitään ei tässä työssä provisionoida tuotantoon:

| Asetus | Tarkoitus |
|---|---|
| `AVEROMIRA_OPERATIONS_ENABLED` | oletus false; vain Production ja tunnettu Vercel-projekti |
| `AVEROMIRA_OPERATIONS_MODE` | oletus shadow; aktiivinen työ vasta `active` |
| `AVEROMIRA_DOCUMENT_QUEUE_ENABLED` | uusi PDF-intake ja legacy-polun sulkeminen |
| `AVEROMIRA_AI_LEDGER_ENABLED` | nykyisten kolmen AI-polun yhteinen ledger |
| `AVEROMIRA_WORKER_DATABASE_URL` | rajattu worker-login, TLS verify-full; ei admin-yhteyttä |
| `AVEROMIRA_OPERATION_STORAGE_KEY` | erillinen lyhytikäinen custom-role Storage JWT |
| `CRON_SECRET` | vähintään 32 merkin worker-tunnus |
| `AVEROMIRA_OPERATIONS_MONITOR_SECRET` | erillinen vähintään 32 merkin liveness-tunnus |
| `AVEROMIRA_AI_PRICING_JSON` | työtyypin malliversio, hinnastoversio, tokenhinnat, ennakkovaraus ja output-katto |
| `AVEROMIRA_OPERATIONS_ALERT_EMAIL` | rajattu perustajan hälytysosoite |

Nykyiset OPENAI/RESEND- ja tuki-/tarjoussähköpostiasetukset säilyvät. SQL:n tyyppiaktivoinnit, tenant-rajat ja system/public-AI-scope tehdään erillisen hyväksynnän jälkeen. Preview ei pääse tuotantojonoon vaikka aktivointimuuttuja olisi väärin kopioitu: ympäristö- ja projektitarkistus sulkevat endpointit ja uudet intake-polut.

## Maksuton ajastus

Vercel Hobby ei tue suunnitelman minuutticronia; nykyinen varmennettu taso on Hobby. Maksullista tasoa ei hankita. Valmisteltu vaihtoehto hyödyntää nykyistä GitHub Actionsia: `operations-tick.yml` ja riippumaton `operations-liveness.yml`, molemmat vain workflow_dispatch ja oletuksena poissa käytöstä. Todellista schedulea ei lisätty eikä workflowja käynnistetty tuotantoa vasten. Viiden minuutin ajastuksen hyväksyntä edellyttää repositoryn Actions-kiintiön ja Vercelin invocation-kiintiön tarkistusta; yksityisen repon kiintiön ylittymistä ei saa hyväksyä automaattisesti. Vaihtoehtoinen pg_cron/pg_net vaatii nykyisten laajennusten ja Vaultiin sijoitettavan endpoint-tunnuksen turvallisen provisioinnin varmennuksen. Ajastuksen valinta ja SLA jäävät aktivointikatselmointiin. Uutta palvelinta tai kuukausipalvelua ei lisätty.

## Testaus ja julkaisuportit

Node-testit harjoittavat oikeaa worker-orchestratoria injektoidulla providerilla. Natiivi PostgreSQL CI käyttää vain paikallista postgres:17.6-konttia ja synteettisiä org/actor/document-tietoja: 100 dokumenttioperaatiota, kaksi rinnakkaista claimia, rinnakkaiset budjettivaraukset, fencing, checkpoint-recovery, idempotenssi, tenant/GRANT-eristys, support-outbox sekä migraatioiden replay. Sama ajo sisältää PR #103:n 43 SQL-regressiota ja SKU-konfliktin eston.

Playwright ajaa todelliset React-intake/queue-komponentit työpöytä- ja mobiilikokoina synteettisillä API- ja Storage-rajoilla. Se testaa kadonneen upload-vastauksen, pysyvän tilan uudelleenlatauksessa, virhe-/tyhjätilan eron, FI/EN-tekstit, näppäimistötoiminnot ja turvallisen virhetekstin. Tämä ei korvaa oikeaa Auth/Storage/PostgREST/PDF-provider staging-integraatiota.

Julkaisuportit: P0-kytkentä ja oikea schema, hyväksytty salattu ja palautettu backup (DB/Auth/Storage/Vault/config), ajantasainen Supabase-staging, rajattu worker- ja Storage-rooli, hinnasto/budjetit/runtime/ajastus, integroidut RFQ/PO/quote/ERP-regressiot ja shadow/canary-näyttö. Puuttuvien porttien vuoksi PRODUCTION NOT READY.

Julkaisujärjestys hyväksynnän jälkeen: P0:n erillinen korjaus ja varmennus → kuusi Phase 2A -migraatiota aikaleimajärjestyksessä → roolien ja asetusten erillinen provisiointi → yhteensopiva sovellus → hyväksytty shadow → pieni canary → rajattu laajennus. Rollback: pysäytä ajastus ja intake, aseta tyyppiaktivoinnit pois, sulje uusi ledger-polku; älä poista pysyviä jobs/ledger/outbox-tauluja tai julkaistuja domain-entiteettejä. Leaset vanhenevat ja generation estää vanhojen workerien kirjoituksen. Sähköpostia/ERP:tä ei uusita rollbackissa.
