# P0: maksuton palautusvalmius ja rajattu diagnostiikka

Tämä on valmisteltu menettely, ei lupa tuotantoajoon. Tuotantomigraatio,
diagnostiikkadeployment ja palveluasetusten muutokset tarvitsevat erillisen luvan.

## Ajonaikaisen projektikytkennän todiste

`/api/support/operator/diagnostics/supabase` on valmisteltu paikallisesti.
Se hyväksyy vain Production-ympäristön ja nimenomaisen Averomiran Vercel-projektin, tuoreen Auth-getUser-varmennuksen,
vahvistetun sähköpostin ja **AVEROMIRA_SUPPORT_ADMIN_EMAILS**-allowlistan.
Työtilan owner/admin-rooli tai reply-to-osoite ei anna pääsyä.
Puuttuva allowlista sulkee reitin. Aikaraja on 12.10.2026 klo 23.59 UTC.
Jos katselmointi tapahtuu myöhemmin, aikaraja on päivitettävä ja testattava ennen julkaisua.

Reitti tekee saman admin-client-factoryn kautta HEAD-lukupyynnön organizations-
tauluun, rajalla 0. Fetch-observer tallentaa todellisen pyynnön Supabase-hostista
vain 20-merkkisen projektitunnisteen. Redirectit kielletään. Palautetaan
projektitunniste, server-admin-konteksti, deployment-commit ja aikaleima.
Ei avaimia, ympäristölistauksia, kokonaisia URL:eja, provider-virheitä tai rivejä.
Vastaus on no-store. Reitti poistetaan todisteen saamisen jälkeen.

Tämä todistaa **uuden hyväksytyn diagnostiikkadeploymentin** palvelinyhteyden;
se ei takautuvasti todista vanhan deploymentin effective-arvoa. Vertaa vanhan ja
uuden deploymentin Supabase-URL-määrittelyn version muuttumattomuus ja muut
konfiguraatioerot yksityisesti ennen kuin väität vanhan version kytkennän todistetuksi.
Ilman tätä rajaa raportoi todiste vain uuden version kytkennästä.

Julkisen login-sivun 8 JS-bundlesta ei löytynyt Supabase-hostia. Nykyiset
kirjautumistoimet ovat server actioneja. Selainmoduulin config-fallback on vain
lähdekoodihavainto. Selainyhteyttä ja palvelinyhteyttä ei nimetään saman todisteen perusteella.

Ennen diagnostiikkajulkaisun lupaa varmista nykyisen explicit support-admin-
allowlistan olemassaolo ja käyttäjän tunnistautumismahdollisuus. Jos se puuttuu,
sen asettaminen on erillinen palveluasetusmuutos. Älä julkaise toimimatonta reittiä
tai laajenna sen oikeuksia huomaamatta. Uusi julkaisu koskee vain diagnostiikkaa,
ei tietokantamigraatiota eikä Phase 2A:ta.

## Backup: hyväksytyllä omalla ympäristöllä ilman tilausta

Supabasen oma CLI-menettely erottaa roles.sql-, schema.sql- ja data.sql-viennit.
CLI vaatii Dockerin. Sopiva Session pooler -yhteys välttää maksullisen IPv4-lisän,
jos direct IPv6 ei ole käytettävissä. Yhteyden käyttäjä ja salasana käsitellään
paikallisessa 0600-tiedostossa tai hyväksytyssä secret store:ssa, ei keskustelussa,
komentorivihistoriassa, lokissa tai repositoryssa. Älä resetoi tuotantosalasanaa
vain viennin vuoksi.

Backup voidaan tehdä myös vähintään tuotannon major-version pg_dump-clientillä.
Yhden custom-format dumpin etuna on yksi yhtenäinen MVCC-snapshot. Sen pitää sisältää
schema, data, omistukset ja ACL:t; lisäksi tarvitaan erillinen rooli- ja jäsenyysvienti
ilman salasanoja. Raw dumpin managed auth/storage-objektit eivät suoraan sovi toiseen
valmiiseen Supabase-projektiin: palautussuunnitelma ja alustariippuvuudet on testattava.
CLI:n filtteröinti ei myöskään automaattisesti tarkoita täydellistä backupia.

Viennin inventaario:

- public/private-schemat: taulut, sekvenssit, funktiot, triggerit, indeksit,
  constraintit, RLS-politiikat, GRANT/REVOKE ja omistukset.
- Sovellusrivit sekä auth-data palautustavoitteen mukaan; henkilötiedot ja
  password hashit ovat suojattavaa dataa myös ilman maksavia asiakkaita.
- auth/storage-schemien omat muutokset ja politiikat erikseen suhteessa alustabaselineen.
- supabase_migrations-historia erikseen; tavallinen CLI-dump ei takaa sen mukanaoloa.
- Extension-versiot ja collations; aikataulut, webhookit, FDW:t ja verkkoa käyttävät
  funktiot inventoidaan ennen eristettyä palautusta.
- Roolit ja jäsenyydet, mutta ei roolien salasanoja dumpiin. Salasanat reprovisionoidaan
  erillisen turvallisen menettelyn kautta.

Kolme erillistä dump-komentoa eivät automaattisesti jaa samaa snapshotia.
Varmista yhteinen snapshot tarvittaessa natiivilla pg_dumpilla tai hyväksytty
lyhyt muutosikkuna ennen viimeistä backupia. Älä muuta tuotantoa read-only-tilaan
ilman lupaa. Storage ja DB eivät muodosta automaattista yhteistä transaktiota.

### Salaus ja säilytys

Käytä tarkistettua asymmetristä salausvälinettä (esimerkiksi age), jonka yksityinen
palautusavain säilyy käyttäjän hyväksytyssä salatussa säilössä erillään backupista.
Vie dump suoraan salausputkeen; älä kirjoita tuotantodumpia plaintextina scratchiin.
`pipefail`, 0600-tiedostot ja 0700-hakemistot ovat pakolliset. Valmis backup on
hyväksytyllä salatulla levyllä/säilytyskohteessa. Ei SQL-dumpeja git-committeihin.
Kirjaa ei-salainen manifest: project ref, versiot, UTC-aika, tiedostokoot,
ciphertext-hashit, kattavuus ja palautustulokset. Säilytä vähintään kaksi
riippumatonta palautettavaa kopiota hyväksytyissä kohteissa.

Ilman olemassa olevaa sopivaa laitetta ja säilytystä nollakustannusta ei voi
luvata. GitHub Actions voi käyttää olemassa olevia ilmaismääriä synteettisiin
testeihin; tuotantodatan käsittely runnerissa tai säilytys artifacteissa tarvitsee
erillisen hyväksynnän. Älä luota julkisiin repoihin tai salaamattomiin artifacteihin.

### Storage ja Vault

DB-dump sisältää Storage-metadatan, ei tavusisältöä. Tarvitaan erillinen
rajattu Storage-vienti, joka paginoi kaikki objektit ja säilyttää bucket/path-,
size-, content-type- ja hash-vastaavuuden salatussa manifestissa. Muuttuvat
objektit havaitaan toisella inventaariolla; vajaata kopiota ei merkitä onnistuneeksi.
Buckets, privacy flags ja RLS-politiikat palautetaan myös. Objektinimet voivat
sisältää henkilötietoja, joten niitä ei lokiteta.

Tarkistetussa Rivora-projektissa on **1 Vault-secret**, sisältöä lukematta.
Vault ciphertext -dump ei yksin riitä palautukseen eri projektiin: projektikohtainen
root key tai turvallinen uudelleenprovisionointi on välttämätön. Root-avainta ei
lueta tämän tehtävän chat-kontekstiin. Sen siirto ja asetukset valmistellaan
käyttäjän hyväksytyn avainsäilön kautta ja testataan eristetyssä palautusympäristössä.
Root key -muutos tuotannossa voisi tehdä vanhan datan lukukelvottomaksi; sitä ei tehdä.

Auth-asetukset, OAuth/SMTP, Realtime, Edge Functions, Storage-asetukset, Vercel-
ympäristö ja DNS eivät palaudu pelkällä DB-dumpilla. Laadi niiden ei-salainen
asetuskartta ja suojattujen lähteiden uudelleenprovisionointipolku.

## Palautustesti ja stagingin eristys

Synteettinen staging ei tarvitse tuotannon avaimia, oikeita sähköposteja tai ERP-yhteyttä.
Natiivin Docker-Postgres-testin workflow on valmisteltu tiedostoon
`.github/workflows/p0-synthetic-recovery.yml`. Se käynnistyy tämän PR:n muutoksista.
Todelliset ajotulokset ja linkit kirjataan kokonaisraporttiin; workflow-tiedosto ei yksin
todista onnistumista. Mukana on kaksi itsenäistä psql-yhteyttä sekä pg_dump/pg_dumpall-,
age-salaus- ja pg_restore-testi uuteen offline-konttiin.
Kontilla on network none ja vain synteettinen data; testit käyttävät docker execiä.

Tuotantobackupin palautus on eri testi ja vaatii hyväksytyn ympäristön. Poista tai
estä palautusympäristön ulosmenevä verkko **ennen** datan palautusta. Käytä omaa
pgdata/socketia, älä tuotanto-URL:ia. Säilytä todellinen recovery-kopio koskemattomana;
schema-only + synteettinen datakopio toimii migraatiotesteissä. Huomioi pg_net,
cron, webhookit, FDW:t, Vault ja muut sivuvaikutukset ennen niiden aktivointia.

Palautuksen hyväksymiskriteerit:

1. Salaus avautuu hyväksytyllä palautusavaimella, eheys tarkistetaan, virheellinen
   ciphertext torjutaan, roolit ja oikeudet palautuvat tarkoituksenmukaisesti.
2. Schema-/constraint-/RLS-/GRANT-inventaario vastaa lähdettä, datamäärät ja
   sekvenssit täsmäävät, FK- ja business-invariantit täyttyvät.
3. Storage-tavumäärät ja kryptografiset hashit vastaavat manifestia; yksityisyys ja
   tenant-eristys säilyvät; yksi synteettinen PDF voidaan ladata palautetusta Storagesta.
4. Vault ja asetukset voidaan palauttaa paljastamatta arvoja lokeihin.
5. Katalogimigraatio onnistuu ajantasaisella schema-baselinella. Uusinta ja
   konfliktipreflight sekä rollback testataan; tuotteiden ID:t, vastineet ja
   tarjoussnapshotit säilyvät. Todellinen usean yhteyden rinnakkaisuustesti läpäisee.
6. API- ja työpöytä/mobiiliselaintestit läpäisevät eristetyllä Auth/Storage/API-pinolla.

Paikallinen WASM-testi ei täytä tätä koko porttia. Se käyttää PostgreSQL 17.5:tä,
20 fixture-taulua ja supistettua Auth-emulaatiota; tarkistetussa projektissa on
39 public/private-taulua ja PostgreSQL 17.6. pgcrypto-luonti jätettiin fixture-
schemaan sovitettaessa pois, koska WASM ei tue extensionia. Varsinainen
katalogimigraatio ajettiin muuttamattomana. pg_trgm on mukana, core sha256 ja
gen_random_uuid ovat oikeita PostgreSQL-funktioita. Supabase Vault/Storage/Auth-
palvelut eivät ole tässä testissä mukana. Ei rinnakkaisia itsenäisiä DB-yhteyksiä.

## Lähteet

- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/guides/self-hosting/restore-from-platform
- https://supabase.com/docs/guides/database/vault
- https://supabase.com/docs/guides/platform/backups
- https://pglite.dev/docs/

## Tuotantokorjauksen portti

P0 pysyy BLOCKED, kunnes runtime-kohde, ajantasainen staging ja palautettava
DB-/Storage-/Vault-/asetuskokonaisuus on varmennettu. Vasta silloin pyydetään
rajatun PR #103 -migraation tuotantoajon lupa. Diagnostiikan julkaisu ei anna
migraatiolupaa. Maksullisia tasoja tai Phase 2A:ta ei aktivoida tämän perusteella.

## Konkreettinen maksuton säilytysehdotus (ei vielä hyväksytty)

Ensisijainen kohde on käyttäjän jo omistama luotettu tietokone ja salattu levy;
olemassa olevilla resursseilla kuukausikustannus on 0 €. Yksityinen age-palautusavain
säilytetään erillisessä käyttäjän hyväksymässä salatussa avainsäilössä ja sen
palautus varmistetaan ennen oikean datan vientiä. Sama laite voi ajaa eristettyä
PostgreSQL 17 -konttia sekä paikallista Supabase-pinoa Auth/Storage-testaukseen.
Natiivin tietokantatestin offline-kontti on eri asia kuin koko Supabase-palvelupino.

Toinen mahdollinen kohde on käyttäjän Proton Drive Free -tili (0 €/kk, enintään
5 GB tilin käyttöönottovaatimusten ja vapaan tilan mukaan), johon tallennettaisiin
ainoastaan valmiiksi age-salattu arkisto. Proton ilmoittaa päästä päähän salauksen.
Tiliä, sen omistajuutta, kapasiteettia tai soveltuvuutta Averomiran datalle ei ole
todennettu, eikä mitään siirretä ennen käyttäjän kohdehyväksyntää. Avainta ei
säilytetä arkiston rinnalla tässä tilissä. iPhone voi säilyttää salatun arkiston,
mutta ei yksin tarjoa natiivin PostgreSQL/Supabase-palautustestin suoritusympäristöä.

Puuttuvat resurssit: hyväksytty säilytyskohde ja sen omistajuus/kapasiteetti,
hyväksytty erillinen avainsäilö sekä luotettu palautustietokone tai käyttäjän
olemassa oleva palvelin. Käyttäjän resursseista ei saatu tässä tarkistuksessa
vahvistusta. Olemassa oleva tai luotetusti lainattu kone voi ratkaista tämän ilman
kuukausimaksua; ilmainen pilvitallennus ei ratkaise puuttuvaa palautuskonetta.
Uusia maksullisia resursseja ei tilata. 5 GB:n riittävyys selviää vasta hyväksytyllä
objektikoko- ja tietokantainventaariolla; kapasiteettia ei oleteta riittäväksi.

Tuotannon schema-only-vienti tehdään vasta oikean projektin varmennuksen jälkeen
käyttäjän hyväksymässä paikallisessa ympäristössä. Myös DDL voi sisältää literal-
salaisuuksia, joten se tarkastetaan ja puhdistetaan siellä ennen testiympäristöä.
Vertaa inventaariossa taulut, funktiosignatuurit, politiikat, triggerit, indeksit,
extensionit ja migraatiohistoria; lisää vain synteettiset rivit. Auth/Storage/Vault-
alustariippuvuudet toisinnetaan vastaavaan paikalliseen Supabase-pinoon ja ulospäin
lähtevät integraatiot estetään ennen testausta. Tätä ei ole vielä toteutettu.

Lähde: https://proton.me/drive/pricing
