# Archived PR #112 report at recovery

This is the PR description recovered at `21e45ab` before the continuation. Its head-specific test counts, Preview and status describe that previous delivery. See [continuation](CONTINUATION-2026-10-15.md) for subsequent work.

## Workspace 3.2 + Motion 3.2 — toteutusraportti 15.10.2026

Kirjautuneen Averomiran shell, navigaatio ja Sales Copilot on toteutettu hyväksytyn kehotteen **version 1.1** mukaan. Nykyiset sivut, palvelimen guardit, API-sopimukset ja liiketoimintatyönkulut säilyvät. Tämä raportti on tämän toimeksiannon määräävä loppuraportti; vanhojen vaiheiden kuvauksia ei käytetä nykytilan todisteena.

| Kokonaisuus | Tila |
|---|---|
| Toteutus | **KESKEN** hyväksynnän kannalta: koodi ja toimiva eristetty kehitysversio toimitettu; suojatun Preview-sovelluksen smoke ja jäljempänä yksilöity integraatio-/laitevarmennus puuttuvat |
| Automaattinen QA | **PASS** — viimeisen headin CI, Workspace ja Operations |
| Auth-/oikeusintegraatio | **NOT RUN** — kirjautuneen Next/rooli/workspace-integraation osalta |
| Preview | **READY** — oikea branch ja SHA varmennettu deployment-metadatasta; sovellussmoke **NOT RUN** |
| Fyysinen iPad Safari | **NOT RUN** |
| Julkaisuportti | **ESTETTY** — Preview-smoke, auth/roolit, laajempi detail-/RFQ/PO-varmennus, oikea selainzoom ja fyysinen iPad/iOS |

### 1. Toteutus ja rajaus

- Yksi app-teema ja app-portaaliscope: `--app-bg:#FAF6F2`, valkoiset nav/main-pinnat, tunnistettavat kontrollirajat `#8D7B6D` ja yhteinen fokus `#705A4A`. Copilot käyttää samaa päätaustaa ilman ympäröivää keskustelukorttia. Nykyinen navigaation logo säilyy.
- Gridissä aidot 16 px:n lämpimät kaistat. Mainissa 12 px:n ylä-/alaväli, 1 px:n raja myös vasemmalla ja kulmat 0/16/16/0. Dokumentti vierii luonnollisesti; nav ja desktop-Copilot ovat sticky-pintoja.
- Sama **mitattu shell-leveys** ratkaisee palstajaon ja modaliteetin. Nav 232/68 px; Copilot 360/384/400 px. Tabletin drawer, overlay ja mobiilin fullscreen säilyttävät yhden keskusteluinstanssin.
- Navin linkkialue vierii matalassa näkymässä; viimeinen linkki ja account ovat saavutettavia 600/450 px:n korkeudessa. Preferenssi, haku, shortcut, query/hash ja back/forward toimivat. Team käyttää nykyistä owner/admin-roolia; Leads käyttää edelleen palvelimelta tulevaa nykyistä feature-/roolitietoa.
- Yhteinen modal-pino naville, Copilotille ja nykyiselle SupportCenterille: inert, fokusrajaus, Escape, backdrop, fokuspalautus ja aiempien body-tyylien/scroll-aseman palautus. Desktopiin palatessa lukitus poistuu.
- Copilot säilyttää session keskustelun ja luonnoksen suljettaessa. Kontekstin vaihto hylkää myöhäisen vastauksen ja vaihtaa näkyvän datan. Historiaa lukevaa käyttäjää ei pakoteta alas; uusin-painike toimii. Composer kasvaa, mobiili-Enter rivittää, IME ei lähetä, kaksoislähetys estyy ja virhe säilyttää korjattavan tekstin. Clipboard-vahvistus seuraa vain onnistunutta operaatiota.
- Appin motion-tokenit on keskitetty; jäljellä olleet 25 paikallista app-/Support-kestoa sovitettu niihin. Copilot 280/200 ms, sulkeutuva pinta inert, kolmas palsta poistuu exitin jälkeen, reduced motion ohittaa odotuksen. Navin leveys vaihtuu välittömästi pitkän listan jatkuvan leveyden interpoloinnin välttämiseksi.
- Sisältöalueen container queryt sovittavat oikeita sivuja. Tilauksen viite säilyy kokonaisena ilman kaksinkertaista näyttöä kapeassa rivissä. Suurennetun mobiilitopbarin teksti rivittyy myös leveämmillä järjestelmäfonteilla.
- Vanhat ristiriitaiset app-shell-/nav-säännöt poistettu globalsista. Julkisen/auth-pinnan käyttämiä yhteisiä legacy-sääntöjä rajattu niin, että niiden ulkoasu säilyy sovelluksen ulkopuolella.

**Rajattu build-korjaus:** lähtö-SHA:n erillinen webpack-build epäonnistui Nextin hylkäämään ylimääräiseen `contextExcerpt`-route-exportiin. Poistettiin vain `export`-avainsana. Funktion sisältö, GET/POST, autentikointi, read-only-oikeudet, 12/10 min ja 60/päivä -rajat sekä AI-/ERP-logiikka säilyvät.

Ei uusia riippuvuuksia, migraatio-/skeema-/RLS-muutoksia, tuotantotilejä, auth-ohitusta sovellukseen, uusia AI-työkaluja, domain-muutoksia, main-mergeä tai tuotantojulkaisua. Nykyiset SQL-testit ajettiin CI:n eristetyssä PostgreSQL:ssä.

### 2. GitHub, lähteet ja baseline

- Repository: `miromnb-coder/Rivora`; sama haara `codex/averomira-workspace-copilot-3-0`; sama avoin PR **#112**.
- Lähtö/head: `f1908f5978ac1b65c0e026b601eb0bc1bee1cb38`.
- Lopullinen head: **`21e45ab92609580c4fb2fc093d0b294614d91d22`**.
- Main/base alussa ja lopussa: **`eb4a11824f9693668e12936ab66a61e3270174e7`**, muuttumaton.
- Omat commitit: `5fdf792`, `fc18922`, `3fa2945`, `067b91d`, `bac09e6`, `9d1bdfb`, `c8a2279`, `21e45ab`. Ei force pushia; alkuperäinen PR-työ säilyy. Lopullinen työpuu puhdas.
- Lähtöcheckoutissa ei muiden keskeneräisiä muutoksia. Alkuperäinen diff tallennettu; matalan navin review-havainto [r4280945948](https://github.com/miromnb-coder/Rivora/pull/112#discussion_r4280945948) käsitelty scroll-rakenteella ja selainkokeilla.
- Baseline: typecheck PASS, Node-ajossa 43 testitiedoston tulosta PASS, build FAIL yllä kuvatun route-exportin vuoksi. Baseline-selainten koko matriisi NOT RUN; suorituskykyvertailu tehtiin erillisellä lähtö-SHA:n fixturellä.
- Driven [suunnittelutaustan](https://docs.google.com/document/d/1XB5377-iHdGYGA1Pz44V7_tISW4y3Zvj/edit) luettava tekstisisältö oli saatavilla. Käyttäjän versio 1.1 ratkaisee sen vanhempien mittojen ristiriidat. Hyväksyttyä viitekuvaa ei ollut käytettävissä; Prompt Motion -videoita ei väitetä katsotuiksi.

### 3. Preview

- **URL:** https://rivora-3yc6juffr-miromnb-coders-projects.vercel.app
- Deployment: `dpl_G7WPWizeb7kVXUi1SCV1y2cq6mEe`; **READY**.
- Branch: `codex/averomira-workspace-copilot-3-0`; SHA: **`21e45ab92609580c4fb2fc093d0b294614d91d22`**.
- Ympäristö: **Preview**, deploymentin `target:null`; ei Production-deployment.
- Backendin eristys/yhteiskäyttö: **UNKNOWN**. Haarakohtaisen env-metadatan puuttuminen ei osoita eristystä. Previewta käsiteltiin mahdollisesti yhteistä backendia käyttävänä.
- Turvallinen tarkistus: deployment-metadata ja tavalliset kirjautumattomat GET-pyynnöt juureen sekä `/app`: molemmat **302** Vercelin suojaukseen. Sovelluksen reittejä tai kirjautunutta istuntoa ei tämän kautta varmennettu.
- **PREVIEW APP SMOKE: NOT RUN.** Todellisia AI-, ERP-, sähköposti-, tuonti- tai hyväksyntäkutsuja ei käynnistetty. Teknisiä palvelulokeja voi syntyä tavallisista lukuoperaatioista.
- Lähtö-Preview `rivora-lzfdesibc-miromnb-coders-projects.vercel.app` varmennettiin alussa READY-tilaan SHA:lla `f1908f5`; sitä ei käytetä lopputuloksen Previewna.

### 4. Visuaalinen ja suorituskyvyn näyttö

Laajennettu nav, avoin desktop-Copilot; mitat border-box/content-box kuten kehotteessa. Molemmat välit 16 px, mainin yläväli 12 px ja mainin vasen raja 1 px. Lopun alaväli ja suljetun paneelin oikea 16 px:n väli tarkistettu selaimissa.

| Viewport / todellinen shell | Nav | Main ulko | Sisältö | Copilot |
|---:|---:|---:|---:|---:|
| 1200 / 1200 | 232 | 576 | 510 | 360 |
| 1280 / 1280 | 232 | 656 | 590 | 360 |
| 1440 / 1440 | 232 | 816 | 750 | 360 |
| 1680 / 1680 | 232 | 1032 | 966 | 384 |
| 1920 / 1920 | 232 | 1256 | 1190 | 400 |

Shellin ja Copilotin computed background on **rgb(250, 246, 242)**. Koko sivun vaakavuotoa ei sallita. Chromiumin varattu scrollbar-gutter ja WebKitin erikseen rajattu käytettävä konttileveys testaavat yhteistä breakpoint-tulkintaa; WebKitin overlay-scrollbaria ei nimetä classic-scrollbar-testiksi.

Geometria kattaa 320, 390, 430, 767, 768, 1023, 1024, 1180, 1199, 1200, 1280, 1440, 1599, 1600, 1680, 1919 ja 1920 CSS-px. Kuvia on katsottu silmin, mukaan lukien tiukka desktop, fullscreen, tuotetyyppi ja pitkä tilauslista. CI:n ensimmäinen ajo löysi suurennetulla tekstillä **323 px / 320 px** -vuodon; se korjattiin UI:ssa ja alkuperäinen 320 px:n assertio säilytettiin. Testi sisältää nyt lisäksi Arial/monospace-stressin.

- [Viimeisen SHA:n HTML-raportti, mitat, kontrastit, kuvat ja jäljet](https://github.com/miromnb-coder/Rivora/actions/runs/38752026133/artifacts/11980954409).
- [Versionoidut mittaukset, valitut synteettiset kuvat, menetelmät ja reittiluettelo](https://github.com/miromnb-coder/Rivora/tree/21e45ab92609580c4fb2fc093d0b294614d91d22/docs/workspace-3.2). Näissä aiemman `067b91d`-näytön SHA on merkitty; viimeisen headin ensisijainen näyttö on yllä oleva CI-artifact.
- Public/auth-vertailu: etusivun **438** ja loginin **34** elementin computed-värit, typografia, reunat, välit ja mitat täsmäävät baseline/current-CSS:llä 1440×900:ssa.
- Sama 65-rivinen fixture ennen/jälkeen: JS gzip **222965 → 226123 B**, CSS gzip **73512 → 68718 B**. Nämä ovat fixture-paketteja, eivät Next-reitin tuotantobundle-lukuja. Vertailun layout-mittauksia tehdään testissä; sovellukseen ei lisätty jatkuvaa mittauskirjoitussilmukkaa. Uusia riippuvuuksia ei tullut.
- Viimeisessä suorituskykynäytteessä baseline havaitsi 2 pitkää työtä (52/68 ms), uusi versio 0; resize ei lisännyt konteksti-GETejä (2 → 2), POST-kutsuja 0. Kyse on rajatusta havainnosta samassa ympäristössä, ei yleisestä suorituskykylupauksesta.

### 5. Toiminnallinen QA

Kaikki alla olevat lopulliset CI-tulokset koskevat **`21e45ab`**. Paikallinen Linux käytti Node 24.19:ää; CI käyttää Node 22:ta.

| Vaatimukset / taso | Menetelmä | Tulos ja määrät |
|---|---|---|
| TOK/UI/LAY/RESP/SCROLL/NAV/ROUTE/CHAT/MOD/MOT/A11Y/PAGE, A | `npx playwright test --config playwright.workspace.config.ts --list` ja varsinainen ajo | **PASS, 66/66, 0 failed, 0 skipped**; 33 Chromium + 33 WebKit |
| Nykyiset yksikkö-/sopimustestit | `npm test` viimeisen SHA:n CI-lokista | **PASS, 310/310, 0 failed, 0 skipped**; paikallinen Node 24 raportoi erikseen 43 testitiedoston tulosta |
| TypeScript | `npm run typecheck` | **PASS**, paikallinen ja CI |
| Tuotantokäännös ilman julkaisua | `npm run build` | **PASS**, paikallinen ja CI |
| Operations-regressio, A | `npx playwright test --config playwright.operations.config.ts` | **PASS, 8/8, 0 failed, 0 skipped** |
| Nykyinen eristetty Operations SQL | `bash scripts/test-operations-sql.sh` | **PASS, 43 assertionia**, 100 synteettistä dokumenttijulkaisua ja rinnakkaisuus-/idempotenssitarkistukset |
| Diff / SAFE / BASE | `git diff --check f1908f5...HEAD`, muuttuneet rivit, origin-refit ja puhdas työpuu | **PASS** |
| Public/login/onboarding, rajattu paikallinen smoke | Oikean buildin GET + computed-vertailu | **PASS**: home/login 200; guest `/app` ja `/onboarding` → `/login` |
| Kirjautunut auth/rooli/workspace-integraatio, B | Turvallista kirjautunutta testijärjestelyä ei ollut | **NOT RUN** |
| Todellinen Preview-sovellussmoke, C | Vercel Authentication estää sovellukseen pääsyn | **NOT RUN** |
| Oikea 200/400 % selainzoom | Ei korvattu deviceScaleFactorilla tai CSS-zoomilla | **NOT RUN**; 320 CSS-px ja suurennettu teksti ovat erilliset PASS-testit |
| Fyysinen iPad / iOS-näppäimistö | Laitetta ei ollut käytettävissä | **NOT RUN** |

CI-linkit: [CI / typecheck, 310 testiä, build](https://github.com/miromnb-coder/Rivora/actions/runs/38752026006), [Workspace 66](https://github.com/miromnb-coder/Rivora/actions/runs/38752026133), [Operations / SQL + 8 selaintestiä](https://github.com/miromnb-coder/Rivora/actions/runs/38752026117). Workspace-loki vahvistaa sekä `Total: 66 tests` että `66 passed`; pelkkää jobin nimeä ei käytetä näyttönä.

Tason A fixture käyttää oikeita AppShell-, AppNav-, SalesCopilot- ja SupportCenter-komponentteja sekä viittä oikeaa server-sivua synteettisellä data-adapterilla. Se sijaitsee Next-reittipuun ulkopuolella. Server actionit heittävät virheen, palvelin estää kirjoitukset, vieraat originit epäonnistuttavat testin ja chat on mockattu. Tämä ei todenna oikeaa AI-palvelua tai palvelimen roolirajoja.

Kokeet kattavat muun muassa luonnollisen dokumenttivierityksen hiiren scroll-eleellä, matalan navin keyboardin, persistence/estetyn tallennustilan, query/hash/back-forwardin, overlayn resize/route/close-cleanupin, Supportin modal-pinon, Enter/IME/autogrown, kaksoislähetyksen, pendingin aikaisen lukukohdan, uusimpaan siirtymisen, myöhäisen workspace-vastauksen hylkäämisen, rate-limitin, verkko-/timeout-virheen, Clipboardin onnistumisen/epäonnistumisen sekä reduced motionin. Fyysistä kosketusvieritystä ei päätellä window.scrollY-mittauksesta.

### 6. Puutteet, hyväksyntä ja palautuminen

- Previewn kirjautunut sovellus, auth-/workspace-vaihto oikeassa Next-istunnossa, guest/workspace puuttuu/session expiry -integraatio ja serverin owner/admin/Leads-rajat tarvitsevat turvallisen integraatiotason varmennuksen. Lähdekoodi ja nykyiset guardit on luettu; UI-roolifixture ei korvaa tätä.
- Kaikki nykyiset app-reitit kääntyvät ja niiden tiedot/guardit säilyvät. Viiden sivutyypin lisäksi Support/Operations sai selainpeiton; kaikkien record/detail-, RFQ/PO-, Settings- ja Memory-työnkulkujen syvä runtime-tarkistus on **NOT RUN**.
- Oikea selainzoom, iOS-osoiterivi, orientaatio ja virtuaalinäppäimistö ovat varmentamatta. Nykyinen visualViewport-fallback säilytettiin ja sen omistamat tyylit siivotaan esitystavan vaihtuessa.
- **REAL IPAD SAFARI: NOT RUN — physical device validation required.**
- Julkaisuportti pysyy estettynä. Tämä toimeksianto ei anna myöhemminkään lupaa main-mergeen tai tuotantoon julkaisemiseen.
- Palautus tehdään vain tämän työn omista commiteista säilyttäen alkuperäinen `f1908f5`-työ. Ei force pushia eikä tietokantapalautusta.

**Preview-pääsyn erillinen este:** automaattinen hyväksyntätarkastus hylkäsi suojatun Previewn hakutyökalun, koska se voi luoda väliaikaisen autentikoinnin ohituslinkin ja muuttaa Previewn pääsyrajaa. Tätä sivuvaikutusta ei katsottu erikseen valtuutetuksi. Suojausta ei kierretty toisella menetelmällä; linkin luomiseen tarvitaan käyttäjän nimenomainen päätös.


