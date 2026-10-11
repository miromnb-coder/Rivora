# Ohjattu katalogituonti

Katalogituonti käyttää yhtä palvelinpuolista parseria ja tietokannan esikatselu–vahvistuspolkua. Vanha suora `import_catalogue_rows`-RPC hylkää pyynnön: myös API-käyttäjän on luotava esikatselu ja vahvistettava sen import-ID. RFQ/PO:n `parseNumber`-sopimus säilyy ennallaan.

## Käyttö ja kenttäkartat

1. Valitse CSV tai yhden laskentataulukon XLSX. CSV:n tuetut erottimet ovat pilkku, puolipiste, sarkain ja pystyviiva. Automaattisen tunnistuksen pitää olla yksiselitteinen; käyttäjä voi valita erottimen itse. CSV:n merkistön tulee olla UTF-8.
2. Tarkista ehdotetut sarakkeet. SKU ja tuotenimi ovat pakollisia. Muut sarakkeet voidaan ohittaa. Yhtä lähdesaraketta ei voi käyttää kahdessa kentässä. Kartan voi tallentaa organisaatiolle, muokata samalla nimellä tai poistaa. Eri tiedostomuodoille on erilliset kartat. Aiempaa karttaa ehdotetaan vain saman otsikkorakenteen tiedostolle.
3. Valitse oletuksena **Lisää tai päivitä tuotteita**. **Korvaa koko katalogi** näyttää myös deaktivoitavat tuotteet ja vaatii erillisen vahvistuksen. Tarkista tuotekohtaiset vanhat ja uudet arvot. Esikatselu on voimassa yhden tunnin. Kartoitukseen palaaminen mitätöi vanhan esikatselun.
4. Virheellistä aineistoa ei tuoda osittain. Virheilmoitus sisältää rivin, sarakkeen, alkuperäisen arvon, syyn ja korjausohjeen. Näytössä on enintään 500 virhettä; ladattava CSV sisältää koko raportin. Raportin arvot suojataan taulukkolaskennan kaavainjektiolta.
5. Vahvista tuonti. Onnistuminen näytetään vasta vahvistetun tietokantatapahtuman jälkeen. Katkenneen vastauksen jälkeen sama vahvistus voidaan lähettää uudelleen: sama import-ID ei tee toista tietokantapäivitystä.

### Hinnat ja varastosaldo

Hyväksytään ei-negatiiviset luvut, enintään neljä desimaalia ja `numeric(14,4)`-raja. JSON-siirto ei saa muuttaa desimaalikerrointa. Esimerkkejä:

| Arvo | Tulkinta |
| --- | --- |
| `1234`, `1234,56`, `1234.56` | Kelvollinen luku |
| `1 234,56`, NBSP/ohut NBSP tuhaterottimena | Kelvollinen luku |
| `1,234.56`, `1.234,56` | Kelvollinen luku, ryhmittely tarkistetaan |
| `0` | Eksplisiittinen nolla |
| Tyhjä hinta | Puuttuva hinta; tarjous vaatii hinnoittelun |
| `1,234`, `1.234` | Epäselvä: käytä välilyöntiä tuhaterottimena tai neljää desimaalia (`1,2340`) |
| `abc`, `sovitaan`, `12x34`, `1e3`, valuuttamerkit, negatiivinen arvo | Virhe |
| Yli neljä desimaalia tai vähintään `10 000 000 000` | Virhe; ei hiljaista pyöristystä |

Varastosaldo käyttää samaa tiukkaa numeerista validointia. Jos saldosaraketta ei ole kartoitettu, nykyinen saldo säilyy. Kartoitettu tyhjä solu tarkoittaa puuttuvaa arvoa. Muut tuodun tuotteen kentät noudattavat nykyistä tuontisopimusta: puuttuvat valinnaiset tiedot näkyvät esikatselussa tyhjinä, yksikön oletus on `pcs`. Hintaa ei päätellä eikä korvata nollalla.

### SKU-identiteetti

Auktoritatiivinen avain on PostgreSQL:n `lower(btrim(sku))`, organisaation sisällä. Tuonnin rivikohtainen duplikaattitarkistus hakee samat avaimet tietokannasta, joten myös JavaScriptin ja tietokannan Unicode-erot käsitellään johdonmukaisesti. Välimerkit säilyvät: `ABC-1` ja `ABC1` ovat eri identiteettejä. Tuotevastaavuuksien nykyinen hakunormalisointi voi edelleen poistaa välimerkkejä hakuehdotuksia varten; varsinainen viittaus on product-ID.

Kirjainkoon vaihtuminen päivittää vanhaa tuotetta säilyttäen sen ID:n ja näyttömuotoisen SKU:n. Tuotevastineet ja kaupalliset snapshotit säilyvät. Migraation uniikki indeksi kattaa myös inaktiiviset tuotteet. Olemassa oleva SKU-konflikti pysäyttää migraation ennen indeksin luontia; tuotteita ei yhdistetä, nimetä uudelleen tai poisteta automaattisesti.

### AI-ehdotus

Deterministiset aliakset ja manuaalinen kartoitus toimivat ilman AI:ta. Käyttäjä voi erikseen pyytää AI-ehdotuksen. Palvelin lähettää nykyiselle OpenAI-palveluntarjoajalle vain enintään 100 sarakeotsikkoa (enintään 200 merkkiä / otsikko), ei tiedostoa tai tuoterivejä. Ehdotus käy läpi saman kenttäkartan validoinnin ja odottaa käyttäjän hyväksyntää. Puuttuva avain, aikakatkaisu, virheellinen vastaus tai keksitty sarake palauttaa manuaaliseen kartoitukseen. Mallin oletus on `gpt-4.1-mini`; palvelin voi käyttää `CATALOGUE_MAPPING_MODEL`-asetusta. Tämä ei aktivoi palveluita tai muuta palveluntarjoajasopimuksia.

## Rajat ja resurssiturvallisuus

- Parseri: enintään 10 MiB, 25 000 tuotetta, 100 saraketta, 5 000 merkkiä solussa ja 250 000 käsiteltävää solua. Myös purettujen rivien JSON-tietosisältö rajataan 10 MiB:iin: toistuvat XLSX shared strings eivät saa paisuttaa RPC-pyyntöä rajatta. Vercel-ympäristön tiedostoraja on 4 MiB sen 4,5 MB HTTP-rajan vuoksi. Isomman tiedoston voi jakaa osiin lisää/päivitä-tilassa; osat eivät ole koko katalogin korvaus.
- XLSX: yksi laskentataulukko, enintään 1 000 ZIP-entryä, yksittäinen purettu entry enintään 32 MiB, yhteensä 48 MiB, pakkaussuhde enintään 100 (pienille entryille 1 MiB jousto). ZIP64, salatut, päällekkäiset ja virheelliset rakenteet hylätään. Todellinen purettu koko tarkistetaan rajatulla inflaterilla, ei vain tiedoston ilmoittamilla metatiedoilla. XML-entiteetit/DOCTYPE hylätään. Rivi- ja sarakeviittaukset tarkistetaan ennen ExcelJS-workbookin lataamista. Kaavat ja Excel-virhesolut hylätään: korvaa ne arvoilla.
- CSV: tiukka sarakerakenne, yksilölliset otsikot, rajattu tietuemäärä ja tietueen pituus. Tiedostorajaa valvotaan myös HTTP-virtaa luettaessa, vaikka Content-Length puuttuu tai on väärä.
- Selaimessa käsittelyn tuplakäynnistys estetään. Palvelinprosessissa sallitaan enintään kaksi käsittelyä ja yksi / organisaatio. Tämä on prosessikohtainen resurssiraja; eri serverless-instanssit voivat tehdä saman esikäsittelyn. Tietokantavahvistuksen idempotenssi ja lukitus kattavat kaikki instanssit.
- Organisaatiolla voi olla enintään viisi voimassa olevaa esikatselua. Lähdetiedostoa ei tallenneta. Vahvistetun tai perutun esikatselun tuoterivit ja yksityiskohtainen suunnitelma poistetaan; aggregaatit jäävät auditointiin. Vanhentuneen esikatselun aineisto siivotaan organisaation seuraavan valmistelupyynnön yhteydessä. Yhden tunnin voimassaolo ei siis ole taustalla ajettava fyysisen poistamisen SLA.
- Muutoslistan sivukoko on enintään 50, ja sitä pienennetään pitkien arvojen mukaan. Kokonaiset arvot säilyvät tarkasteltavina; HTTP-vastaus pysyy Vercelin rajan alapuolella.
- Rivivirheiden JSON-otos ja CSV-raportin yksittäinen vastaus rajataan 2 MiB:iin. Selain lataa raporttisivut ja yhdistää ne yhdeksi täydelliseksi CSV-tiedostoksi. Alkuperäisiä virhearvoja ei typistetä; tiedoston lukuvaiheen viiden rivin esimerkkinäkymässä pitkä solu näytetään 200 merkin otteena.

## Tietokanta ja julkaisu

Migraatio: `supabase/migrations/20261010140726_catalogue_integrity_guided_import.sql`.

Uudet julkiset RPC:t: `catalogue_sku_keys`, `prepare_catalogue_import`, `commit_catalogue_import`, `catalogue_preview_action`. Wrapperit ovat SECURITY INVOKER. Privilegioidut toteutukset ovat private-schemassa, ja ne tarkistavat autentikoidun käyttäjän owner/admin-jäsenyyden sekä organisaation ja tekijän. Anon-roolilla ei ole execute-oikeutta. Kenttäkarttataulussa on organisaation owner/admin-RLS sekä UPDATE:n USING ja WITH CHECK.

Kaikki tuotteiden INSERT/UPDATE/DELETE-operaatiot muuttavat organisaation katalogirevisiota ja osallistuvat samaan lukitukseen. Vahvistus tarkistaa revision, määräajan ja uudelleen lasketun suunnitelman. Tuote-, revisio-, idempotenssi- ja auditointikirjoitukset tehdään samassa transaktiossa. Auditointi sisältää import-ID:n, organisaation, tekijän, ajankohdan, tilan, tiedoston SHA-256:n ja palvelimen laskeman yhteenvedon. Olemassa olevia tarjouslukkoja ei korvata.

Ennen myöhemmin erikseen hyväksyttävää tuotantojulkaisua:

1. Varmenna todelliset tietokanta- ja Storage-varmuuskopiot sekä palautusmenettely. Tämä toteutus ei tee varmuuskopioita tai asetusten aktivointeja.
2. Aja konfliktien lukutarkistus uudelleen juuri ennen migraatiota:

   ```sql
   begin read only;
   select organization_id, lower(btrim(sku)) as sku_identity, count(*)
   from public.products
   group by organization_id, lower(btrim(sku))
   having count(*) > 1;
   commit;
   ```

   Mahdolliset tulokset käsitellään valtuutetussa yksityisessä ympäristössä. Älä julkaise asiakkaan SKU-tietoja PR:ssä.
3. Testaa nykyistä tuotantorakennetta vastaavassa eristetyssä stagingissa. Repositorion vanha schema.sql ei yksin sisällä kaikkia historiallisia tuotantorakenteita; paikallisen testin erilliset fixture-täydennykset dokumentoivat tämän.
4. Koordinoi migraatio ja sovellusversio huoltoikkunassa. Vanha sovellus käyttää suljettua RPC:tä ja uusi versio edellyttää uusia RPC:itä. Kesken jäänyt versioyhdistelmä epäonnistuu turvallisesti, mutta estää tuonnin.
5. Migraation jälkeen varmista RLS, funktio-oikeudet ja Supabase-advisorit hyväksytyssä ympäristössä. Älä poista indeksillä suojattua identiteettiä tai revision suojausta sovellusrollbackin yhteydessä ilman erillistä suunnitelmaa.

Tähän PR:ään ei kuulu tuotantomigraation ajo, main-merge, tuotantojulkaisu, Auth-asetusten muutos tai palautusharjoitus tuotantotiedoilla.

## Testien toistaminen eristetyssä ympäristössä

Node-testit: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`. Tässä työympäristössä Node-testiajurin oletuseristys raportoi tiedostot; kaikki yksittäiset testit näkyvät komennolla `node --test --experimental-strip-types --test-isolation=none tests/*.test.ts`.

SQL-testit edellyttävät paikallista Docker-daemonia ja **vain synteettistä** PostgreSQL-konttia. Älä anna Docker-kontekstin osoittaa etäpalvelimeen. Skripti käyttää nimenomaista paikallista Unix-socketia ja testikontin nimeä. Se poistaa ja luo uudelleen vain tämän testikontin `averomira_test`-tietokannan. Testit käyttävät SQL-rooleja, RLS:ää ja olemassa olevia kaupallisia triggereitä, eivät JavaScript-jäljitelmää.

```sh
docker --host=unix:///var/run/docker.sock run -d --name averomira-catalogue-test \
  -e POSTGRES_PASSWORD=synthetic-test-only -e POSTGRES_DB=averomira_test postgres:17
npm run test:catalogue:sql
node scripts/test-catalogue-concurrency.mjs
docker --host=unix:///var/run/docker.sock exec -i averomira-catalogue-test \
  psql -U postgres -d averomira_test -v ON_ERROR_STOP=1 < scripts/profile-catalogue-sql.sql
```

Selaintesti käyttää oikeaa sovellusta ja PostgREST/RLS:ää. Vain Auth-palvelu on testissä synteettinen. Täysi Supabase Auth, todellinen AI-palvelu, sähköpostit ja ERP-kirjoitukset eivät kuulu näihin testeihin.

```sh
docker --host=unix:///var/run/docker.sock network create averomira-test-net
docker --host=unix:///var/run/docker.sock network connect averomira-test-net averomira-catalogue-test
docker --host=unix:///var/run/docker.sock run -d --name averomira-postgrest-test \
  --network averomira-test-net -p 127.0.0.1:55432:3000 \
  -e PGRST_DB_URI=postgres://postgres:synthetic-test-only@averomira-catalogue-test:5432/averomira_test \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_JWT_SECRET=synthetic-catalogue-test-jwt-secret-000000000 postgrest/postgrest:v13.0.8
docker --host=unix:///var/run/docker.sock exec -i averomira-catalogue-test \
  psql -U postgres -d averomira_test -v ON_ERROR_STOP=1 < tests/fixtures/catalogue-browser-seed.sql
node scripts/catalogue-test-auth.mjs
```

Käynnistä eri terminaalissa sovellus. Varmista, että palvelinavaimet ovat tyhjät ja URL on paikallinen:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=synthetic-anon \
  OPENAI_API_KEY= SUPABASE_SERVICE_ROLE_KEY= SUPABASE_SECRET_KEY= npm run dev -- --hostname 127.0.0.1
npx playwright install chromium
npm run test:catalogue:browser
```

Parserin resurssiprofiili: `node --expose-gc --experimental-strip-types scripts/profile-catalogue.ts csv` ja vastaava `xlsx`. Generointi on synteettinen; prosessin huippu-RSS sisältää myös testiaineiston luonnin. Mitatut ajot ja operointiasetusten lukuauditointi toimitetaan erillisessä katselmointiraportissa.
