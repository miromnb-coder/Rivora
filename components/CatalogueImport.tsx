"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATALOGUE_FIELDS,
  type CatalogueField,
  type CatalogueMapping,
  type CatalogueIssue,
} from "@/lib/rivora/catalogue-fields";

type Inspection = {
  headers: string[];
  samples: string[][];
  count: number;
  format: string;
  delimiter: string | null;
  mapping: CatalogueMapping;
};
type FieldMap = {
  id: string;
  name: string;
  format: string;
  headers: string[];
  mapping: CatalogueMapping;
};
type Summary = {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  deactivated: number;
  missing_price: number;
  active_before: number;
  change_count: number;
  page_size: number;
  changes?: {
    sku: string;
    action: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown>;
  }[];
};
type Preview = { importId: string; mode: string; summary: Summary };
const labels: Record<string, string> = {
  created: "Lisätään",
  updated: "Päivitetään",
  unchanged: "Ei muutosta",
  deactivated: "Deaktivoidaan",
};
const dataLabels: Record<string, string> = {
  name: "Tuotenimi",
  manufacturer: "Valmistaja",
  manufacturer_part_number: "Valmistajan tuotenumero",
  unit: "Yksikkö",
  unit_price: "Yksikköhinta",
  stock_quantity: "Varastosaldo",
  active: "Aktiivinen",
};
const display = (value: unknown) =>
  value == null
    ? "Puuttuu"
    : typeof value === "boolean"
      ? value
        ? "Kyllä"
        : "Ei"
      : String(value);

export function CatalogueImport({
  canImport,
  maximumFileMegabytes = 10,
}: {
  canImport: boolean;
  maximumFileMegabytes?: number;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null),
    [delimiter, setDelimiter] = useState("auto");
  const [inspection, setInspection] = useState<Inspection | null>(null),
    [mapping, setMapping] = useState<CatalogueMapping>({});
  const [maps, setMaps] = useState<FieldMap[]>([]),
    [mapName, setMapName] = useState(""),
    [selectedMap, setSelectedMap] = useState("");
  const [mode, setMode] = useState("merge"),
    [preview, setPreview] = useState<Preview | null>(null),
    [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<Summary | null>(null),
    [issues, setIssues] = useState<CatalogueIssue[]>([]),
    [issueCount, setIssueCount] = useState(0);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [page, setPage] = useState(0);
  const controller = useRef<AbortController | null>(null),
    requestId = useRef<string | null>(null),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      controller.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!canImport) return;
    let live = true;
    fetch("/api/catalogue/import", { cache: "no-store" })
      .then((r) => r.json())
      .then((r) => {
        if (live) {
          setMaps(r.maps ?? []);
          if (r.error) setNotice(r.error);
        }
      })
      .catch(() => {
        if (live)
          setNotice(
            "Tallennetut kartat eivät ole käytettävissä. Voit kartoittaa käsin.",
          );
      });
    return () => {
      live = false;
    };
  }, [canImport]);
  function form(action: string) {
    const body = new FormData();
    body.set("action", action);
    if (file) body.set("catalogue", file);
    body.set("delimiter", delimiter);
    body.set("mapping", JSON.stringify(mapping));
    body.set("mode", mode);
    return body;
  }
  async function request(action: string, body: FormData) {
    if (controller.current) return null;
    const abort = new AbortController();
    controller.current = abort;
    const current = ++generation.current;
    setBusy(action);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/catalogue/import", {
        method: "POST",
        body,
        signal: abort.signal,
      });
      if (action === "report" && response.ok) {
        const parts: Blob[] = [];
        let part = response,
          offset = 0;
        while (true) {
          parts.push(await part.blob());
          const next = part.headers.get("X-Catalogue-Next-Offset");
          if (!next) break;
          const nextOffset = Number(next);
          if (
            !Number.isInteger(nextOffset) ||
            nextOffset <= offset ||
            nextOffset > 125000
          )
            throw new Error("Virheellinen virheraportin sivutus.");
          offset = nextOffset;
          body.set("reportOffset", String(offset));
          part = await fetch("/api/catalogue/import", {
            method: "POST",
            body,
            signal: abort.signal,
          });
          if (!part.ok) {
            const failure = await part.json();
            setError(failure.error ?? "Virheraportin lataaminen epäonnistui.");
            return null;
          }
        }
        if (current !== generation.current) return null;
        const url = URL.createObjectURL(
          new Blob(parts, { type: "text/csv; charset=utf-8" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = "katalogin-virheet.csv";
        link.click();
        URL.revokeObjectURL(url);
        return null;
      }
      const data = await response.json();
      if (current !== generation.current) return null;
      if (data.issues) {
        setIssues(data.issues);
        setIssueCount(data.issueCount);
        return null;
      }
      if (!response.ok) {
        setError(data.error ?? "Tuonti epäonnistui.");
        return null;
      }
      return data;
    } catch (failure) {
      if (current === generation.current)
        setError(
          failure instanceof Error && failure.name === "AbortError"
            ? "Lataus keskeytettiin. Voit yrittää uudelleen."
            : action === "commit"
              ? "Vahvistuksen tulosta ei voitu varmentaa. Yritä vahvistusta uudelleen samalla tunnisteella; se ei tee muutoksia kahdesti."
              : "Yhteys katkesi tai tiedoston lataus keskeytyi. Yritä uudelleen.",
        );
      return null;
    } finally {
      if (current === generation.current) {
        controller.current = null;
        setBusy("");
      }
    }
  }
  async function inspect() {
    if (file && file.size > maximumFileMegabytes * 1024 * 1024) {
      setError(
        `Tiedosto ylittää tämän ympäristön ${maximumFileMegabytes} MB kokorajan. Poista tarpeettomat sarakkeet tai jaa tiedosto osiin ja käytä lisää/päivitä-tilaa.`,
      );
      return;
    }
    const data = await request("inspect", form("inspect"));
    if (!data) return;
    setInspection(data);
    setIssues([]);
    setIssueCount(0);
    setResult(null);
    requestId.current = null;
    const saved = maps.find(
      (m) =>
        m.format === data.format &&
        JSON.stringify(m.headers) === JSON.stringify(data.headers),
    );
    setMapping(saved?.mapping ?? data.mapping);
    setMapName(saved?.name ?? "");
    setSelectedMap(saved?.id ?? "");
    if (saved)
      setNotice(
        `Ehdotettu tallennettu kartta: ${saved.name}. Tarkista ja hyväksy vastaavuudet.`,
      );
  }
  async function prepare() {
    setIssues([]);
    setIssueCount(0);
    requestId.current ??= crypto.randomUUID();
    const body = form("preview");
    body.set("importId", requestId.current);
    const data = await request("preview", body);
    if (data) {
      setPreview(data);
      setConfirmed(false);
      setPage(0);
    }
  }
  async function commit() {
    if (!preview) return;
    const body = new FormData();
    body.set("action", "commit");
    body.set("importId", preview.importId);
    body.set("confirmReplace", String(confirmed));
    const data = await request("commit", body);
    if (data) {
      setResult(data.result);
      setPreview(null);
      setInspection(null);
      router.refresh();
    }
  }
  async function changePage(nextPage: number) {
    if (!preview) return;
    const body = new FormData();
    body.set("action", "page");
    body.set("importId", preview.importId);
    body.set("page", String(nextPage));
    const data = await request("page", body);
    if (data) {
      setPreview({ ...preview, summary: data.summary });
      setPage(nextPage);
    }
  }
  async function backToMapping() {
    if (!preview) return;
    const body = new FormData();
    body.set("action", "discard");
    body.set("importId", preview.importId);
    if (await request("discard", body)) {
      setPreview(null);
      setConfirmed(false);
      requestId.current = null;
    }
  }
  function changeMapping(header: string, field: string) {
    const next = { ...mapping };
    for (const key of Object.keys(next) as CatalogueField[])
      if (next[key] === header) delete next[key];
    if (field) next[field as CatalogueField] = header;
    setMapping(next);
    setIssues([]);
    setIssueCount(0);
    requestId.current = null;
  }
  async function saveMap() {
    const body = form("saveMap");
    body.set("mapName", mapName);
    if (await request("saveMap", body)) {
      setNotice("Vahvistettu sarakekartta tallennettu organisaatiollesi.");
      try {
        const response = await fetch("/api/catalogue/import", {
          cache: "no-store",
        });
        const data = await response.json();
        setMaps(data.maps ?? []);
      } catch {
        /* Saving succeeded; manual mapping remains available. */
      }
    }
  }
  if (!canImport)
    return <p>Katalogituonti vaatii omistajan tai ylläpitäjän oikeudet.</p>;
  const ready = Boolean(mapping.sku && mapping.name);
  const summary = preview?.summary ?? result;
  return (
    <div className="w-full min-w-0 space-y-5" aria-busy={Boolean(busy)}>
      <h2 className="text-xl font-bold">Ohjattu katalogituonti</h2>
      <ol className="flex flex-wrap gap-3 text-sm" aria-label="Tuonnin vaiheet">
        {["Tiedosto", "Sarakekartta", "Esikatselu ja vahvistus", "Tulos"].map(
          (label, index) => (
            <li
              key={label}
              aria-current={
                (result ? 3 : preview ? 2 : inspection ? 1 : 0) === index
                  ? "step"
                  : undefined
              }
            >
              {index + 1}. {label}
            </li>
          ),
        )}
      </ol>
      <div role="status" aria-live="polite">
        {busy ? "Käsitellään…" : notice}
      </div>
      {error && (
        <div className="upload-v2-alert error" role="alert">
          {error}
        </div>
      )}
      {!inspection && !preview && !result && (
        <div className="space-y-4">
          <label className="block">
            Katalogitiedosto (CSV / XLSX, enintään {maximumFileMegabytes} MB ja
            25 000 tuotetta)
            <input
              className="mt-2 block w-full"
              type="file"
              accept=".csv,.xlsx"
              disabled={Boolean(busy)}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError("");
              }}
            />
          </label>
          <label className="block">
            CSV-erotin{" "}
            <select
              className="ml-2"
              value={delimiter}
              disabled={Boolean(busy)}
              onChange={(e) => setDelimiter(e.target.value)}
            >
              <option value="auto">Tunnista automaattisesti</option>
              <option value=",">Pilkku</option>
              <option value=";">Puolipiste</option>
              <option value={"\t"}>Sarkain</option>
              <option value="|">Pystyviiva</option>
            </select>
          </label>
          <button
            type="button"
            className="btn-secondary"
            disabled={!file || Boolean(busy)}
            onClick={inspect}
          >
            Lue tiedosto ja tunnista sarakkeet
          </button>
        </div>
      )}
      {inspection && !preview && (
        <div className="space-y-4">
          <p>
            {file?.name}: {inspection.count.toLocaleString("fi-FI")} tuotetta.
            Pakolliset kentät: SKU ja tuotenimi. Tyhjä hinta säilyy puuttuvana;
            tarjous vaatii hinnoittelun.
          </p>
          <label className="block">
            Tallennettu sarakekartta{" "}
            <select
              className="ml-2 max-w-full"
              value={selectedMap}
              disabled={Boolean(busy)}
              onChange={(e) => {
                const saved = maps.find((m) => m.id === e.target.value);
                setSelectedMap(e.target.value);
                setMapping(saved?.mapping ?? inspection.mapping);
                setMapName(saved?.name ?? "");
                requestId.current = null;
                setIssues([]);
                setIssueCount(0);
              }}
            >
              <option value="">Aloita uusi kartoitus</option>
              {maps
                .filter(
                  (m) =>
                    m.format === inspection.format &&
                    JSON.stringify(m.headers) ===
                      JSON.stringify(inspection.headers),
                )
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </label>
          <div className="overflow-x-auto">
            <table className="catalogue-mapping-table w-full text-left text-sm">
              <caption className="mb-2 text-left">
                Tarkista jokaisen sarakkeen vastaavuus. Ohitetut sarakkeet eivät
                siirry katalogiin.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Sarake tiedostossa</th>
                  <th scope="col">Averomiran kenttä</th>
                  <th scope="col">Esimerkki</th>
                </tr>
              </thead>
              <tbody>
                {inspection.headers.map((header, i) => (
                  <tr key={header}>
                    <td className="p-2" data-label="Sarake tiedostossa">
                      {header}
                    </td>
                    <td className="p-2" data-label="Averomiran kenttä">
                      <select
                        aria-label={`Sarakkeen ${header} vastaavuus`}
                        value={
                          Object.entries(mapping).find(
                            ([, h]) => h === header,
                          )?.[0] ?? ""
                        }
                        disabled={Boolean(busy)}
                        onChange={(e) => changeMapping(header, e.target.value)}
                      >
                        <option value="">Ohita</option>
                        {Object.entries(CATALOGUE_FIELDS).map(
                          ([field, config]) => (
                            <option
                              key={field}
                              value={field}
                              disabled={Boolean(
                                mapping[field as CatalogueField] &&
                                  mapping[field as CatalogueField] !== header,
                              )}
                            >
                              {config.label}
                              {field === "sku" || field === "name"
                                ? " (pakollinen)"
                                : ""}
                            </option>
                          ),
                        )}
                      </select>
                    </td>
                    <td
                      className="max-w-48 break-words p-2"
                      data-label="Esimerkki"
                    >
                      {inspection.samples[0]?.[i]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!ready && (
            <p role="alert">
              Valitse SKU- ja tuotenimikenttien sarakkeet ennen esikatselua.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <label>
              Kartan nimi{" "}
              <input
                value={mapName}
                maxLength={100}
                disabled={Boolean(busy)}
                onChange={(e) => setMapName(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn-secondary"
              disabled={!ready || !mapName.trim() || Boolean(busy)}
              onClick={saveMap}
            >
              Tallenna vahvistettu kartta
            </button>
            {selectedMap && (
              <button
                type="button"
                className="btn-secondary"
                disabled={Boolean(busy)}
                onClick={async () => {
                  const body = new FormData();
                  body.set("action", "deleteMap");
                  body.set("mapId", selectedMap);
                  if (await request("deleteMap", body)) {
                    setMaps(maps.filter((m) => m.id !== selectedMap));
                    setSelectedMap("");
                    setNotice("Sarakekartta poistettu.");
                  }
                }}
              >
                Poista tallennettu kartta
              </button>
            )}
          </div>
          <p className="text-sm">
            Voit muokata karttaa ja tallentaa sen samalla nimellä. AI-ehdotus
            lähettää vain sarakeotsikot nykyiselle AI-palveluntarjoajalle.
            Tarkista ehdotus ennen jatkamista.
          </p>
          <button
            type="button"
            className="btn-secondary"
            disabled={Boolean(busy)}
            onClick={async () => {
              const body = new FormData();
              body.set("action", "suggestAi");
              body.set("headers", JSON.stringify(inspection.headers));
              const data = await request("suggestAi", body);
              if (data?.mapping) {
                setMapping(data.mapping);
                requestId.current = null;
                setNotice("AI ehdotti kartoitusta. Tarkista kaikki valinnat.");
              } else if (data?.unavailable) setNotice(data.unavailable);
            }}
          >
            Pyydä AI-kartoitusehdotus
          </button>
          <fieldset disabled={Boolean(busy)} className="space-y-2">
            <legend className="font-bold">Tuontitila</legend>
            <label className="block">
              <input
                type="radio"
                name="catalogueMode"
                value="merge"
                checked={mode === "merge"}
                onChange={() => {
                  setMode("merge");
                  requestId.current = null;
                }}
              />{" "}
              Lisää tai päivitä tuotteita — muut tuotteet säilyvät (oletus)
            </label>
            <label className="block">
              <input
                type="radio"
                name="catalogueMode"
                value="replace"
                checked={mode === "replace"}
                onChange={() => {
                  setMode("replace");
                  requestId.current = null;
                }}
              />{" "}
              Korvaa koko katalogi — tiedostosta puuttuvat tuotteet
              deaktivoidaan
            </label>
          </fieldset>
          {issueCount > 0 && (
            <div role="alert" className="space-y-3">
              <p className="font-bold">
                {issueCount} virhettä estää tuonnin. Korjaa lähdetiedosto tai
                sarakekartta. Katalogia ei muutettu.
              </p>
              <ul className="max-h-80 overflow-auto">
                {issues.map((issue, i) => (
                  <li className="mb-3" key={i}>
                    Rivi {issue.row}, sarake {issue.column}, arvo ”{issue.value}
                    ”: {issue.reason} {issue.correction}
                  </li>
                ))}
              </ul>
              {issueCount > issues.length && (
                <p>
                  Näytetään ensimmäiset {issues.length} virhettä. Lataa koko
                  raportti.
                </p>
              )}
              <button
                className="btn-secondary"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => request("report", form("report"))}
              >
                Lataa virheraportti
              </button>
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              className="btn-secondary"
              type="button"
              disabled={Boolean(busy)}
              onClick={() => {
                setInspection(null);
                setIssues([]);
                setIssueCount(0);
                requestId.current = null;
              }}
            >
              Takaisin tiedoston valintaan
            </button>
            <button
              className="btn-primary"
              type="button"
              disabled={!ready || Boolean(busy)}
              onClick={prepare}
            >
              Hyväksy kartta ja näytä muutokset
            </button>
          </div>
        </div>
      )}
      {summary && (
        <div className="space-y-4">
          <h3 className="text-lg font-bold" aria-live="polite">
            {result
              ? "Tuonti onnistui — tietokantatapahtuma vahvistettu"
              : "Tuonnin yhteenveto"}
          </h3>
          <p>
            {(preview?.mode ?? mode) === "merge"
              ? "Lisää tai päivitä tuotteita"
              : "Korvaa koko katalogi"}
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            <li>{summary.created} uutta tuotetta</li>
            <li>{summary.updated} päivitettävää tuotetta</li>
            <li>{summary.unchanged} muuttumatonta tuotetta</li>
            <li>{summary.deactivated} deaktivoitavaa tuotetta</li>
            <li>{summary.missing_price} tuotetta ilman hintaa</li>
            <li>0 virheellistä riviä</li>
          </ul>
          {preview && (
            <>
              {summary.deactivated > 0 && (
                <div className="upload-v2-alert error" role="alert">
                  <strong>
                    Varoitus: {summary.deactivated} tuotetta deaktivoidaan.
                  </strong>{" "}
                  {summary.deactivated >= 100 ||
                  summary.deactivated >= summary.active_before * 0.2
                    ? "Huomattava osa katalogista poistuu käytöstä. "
                    : ""}
                  Deaktivoituja tuotteita ei voi valita uusiin tarjouksiin.
                  Hyväksyttyjen tarjousten tiedot säilyvät.
                </div>
              )}
              <p>
                Kriittisiä virheitä ei löytynyt. Tarkista kaikki muutokset ennen
                tallennusta. Esikatselu on voimassa yhden tunnin.
              </p>
              <div className="space-y-2">
                <h4 className="font-bold">Tuotekohtaiset muutokset</h4>
                {summary.changes?.map((change) => (
                  <details key={change.sku} className="rounded border p-3">
                    <summary>
                      {change.sku} — {labels[change.action]}
                    </summary>
                    <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                      {Object.entries(change.after).map(([field, value]) => (
                        <div key={field}>
                          <dt className="font-semibold">
                            {dataLabels[field] ?? field}
                          </dt>
                          <dd className="break-words">
                            {display(change.before?.[field])} → {display(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ))}
              </div>
              {(summary.change_count ?? 0) > (summary.page_size ?? 50) && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={page === 0 || Boolean(busy)}
                    onClick={() => changePage(page - 1)}
                  >
                    Edellinen
                  </button>
                  <span>
                    Sivu {page + 1} /{" "}
                    {Math.ceil(
                      (summary.change_count ?? 0) / (summary.page_size ?? 50),
                    )}
                  </span>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={
                      (page + 1) * (summary.page_size ?? 50) >=
                        (summary.change_count ?? 0) || Boolean(busy)
                    }
                    onClick={() => changePage(page + 1)}
                  >
                    Seuraava
                  </button>
                </div>
              )}
              {preview.mode === "replace" && (
                <label className="block font-semibold">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={Boolean(busy)}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />{" "}
                  Vahvistan koko katalogin korvaamisen ja {summary.deactivated}{" "}
                  tuotteen deaktivoinnin.
                </label>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  className="btn-secondary"
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={backToMapping}
                >
                  Takaisin sarakekarttaan
                </button>
                <button
                  className="btn-primary"
                  type="button"
                  disabled={
                    Boolean(busy) || (preview.mode === "replace" && !confirmed)
                  }
                  onClick={commit}
                >
                  Vahvista ja tallenna tuonti
                </button>
              </div>
            </>
          )}
          {result && (
            <button
              className="btn-secondary"
              type="button"
              onClick={() => {
                setResult(null);
                setFile(null);
                requestId.current = null;
                setNotice("");
              }}
            >
              Aloita uusi tuonti
            </button>
          )}
        </div>
      )}
      {busy && busy !== "commit" && (
        <button
          className="btn-secondary"
          type="button"
          onClick={() => controller.current?.abort()}
        >
          Keskeytä käsittely
        </button>
      )}
    </div>
  );
}
