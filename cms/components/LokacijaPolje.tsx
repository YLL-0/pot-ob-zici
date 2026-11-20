"use client";

/**
 * Admin location editor for a memorial (PROMPT_ADMIN.md "Lokacija"): a
 * map with a draggable pin, latitude/longitude shown read-only beside it,
 * and a paste field for a field reading such as "45.799489, 15.156234".
 * The editor never types into two separate number inputs — `lat` and
 * `lon` are hidden fields this component writes to.
 *
 * Same basemap and MapLibre worker as the public maps (components/MiniMap.tsx).
 */

import { useEffect, useRef, useState } from "react";
import { Map as MaplibreMap, Marker, NavigationControl, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { FieldDescription, useField } from "@payloadcms/ui";
import { razberiKoordinate, zaokrozi } from "@/cms/koordinate";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

if (typeof window !== "undefined") {
  setWorkerUrl(new URL("/maplibre-gl-worker.mjs", window.location.origin).href);
}

const NOVO_MESTO: [number, number] = [15.1687, 45.8016];

const slogPolja: React.CSSProperties = {
  display: "grid",
  gap: "calc(var(--base) * 0.5)",
  marginBottom: "var(--base)",
};

export function LokacijaPolje() {
  const lat = useField<number | null>({ path: "lat" });
  const lon = useField<number | null>({ path: "lon" });
  const onemogoceno = lat.disabled || lon.disabled;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [vnos, setVnos] = useState("");
  const [sporocilo, setSporocilo] = useState<{ vrsta: "napaka" | "ok"; besedilo: string } | null>(null);

  // Latest setters for the map's event handlers, without re-creating the map.
  const nastaviRef = useRef((novaLat: number, novaLon: number) => {
    lat.setValue(zaokrozi(novaLat));
    lon.setValue(zaokrozi(novaLon));
  });
  useEffect(() => {
    nastaviRef.current = (novaLat: number, novaLon: number) => {
      lat.setValue(zaokrozi(novaLat));
      lon.setValue(zaokrozi(novaLon));
    };
  });

  const imaKoordinate = typeof lat.value === "number" && typeof lon.value === "number";

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const zacetek: [number, number] = imaKoordinate ? [lon.value as number, lat.value as number] : NOVO_MESTO;
    const map = new MaplibreMap({
      container: containerRef.current,
      style: STYLE_URL,
      center: zacetek,
      zoom: imaKoordinate ? 16 : 13,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    const marker = new Marker({ draggable: !onemogoceno }).setLngLat(zacetek).addTo(map);
    marker.on("dragend", () => {
      const { lng, lat: noviLat } = marker.getLngLat();
      nastaviRef.current(noviLat, lng);
      setSporocilo(null);
    });
    if (!onemogoceno) {
      map.on("click", (e) => {
        marker.setLngLat(e.lngLat);
        nastaviRef.current(e.lngLat.lat, e.lngLat.lng);
        setSporocilo(null);
      });
    }
    mapRef.current = map;
    markerRef.current = marker;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // The map is created once; later value changes move the marker below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the pin on the form value (paste, undo/revert, "Ponastavi").
  useEffect(() => {
    if (!imaKoordinate || !markerRef.current) return;
    const tocka: [number, number] = [lon.value as number, lat.value as number];
    const zdaj = markerRef.current.getLngLat();
    if (Math.abs(zdaj.lat - tocka[1]) > 1e-7 || Math.abs(zdaj.lng - tocka[0]) > 1e-7) {
      markerRef.current.setLngLat(tocka);
      mapRef.current?.easeTo({ center: tocka, duration: 400 });
    }
  }, [lat.value, lon.value, imaKoordinate]);

  function prilepi() {
    const rezultat = razberiKoordinate(vnos);
    if (!rezultat.ok) {
      setSporocilo({ vrsta: "napaka", besedilo: rezultat.napaka });
      return;
    }
    nastaviRef.current(rezultat.lat, rezultat.lon);
    setVnos("");
    setSporocilo({
      vrsta: "ok",
      besedilo: rezultat.zamenjano
        ? "Koordinate so bile v obratnem vrstnem redu — zamenjal sem širino in dolžino. Preveri žebljiček."
        : "Žebljiček je premaknjen. Shrani ali objavi, da se sprememba ohrani.",
    });
  }

  const premaknjeno =
    typeof lat.initialValue === "number" &&
    imaKoordinate &&
    (lat.initialValue !== lat.value || lon.initialValue !== lon.value);

  return (
    <div className="field-type" style={slogPolja}>
      <span className="field-label">Lokacija na zemljevidu</span>
      <div
        ref={containerRef}
        role="application"
        aria-label="Zemljevid z žebljičkom obeležja. Žebljiček premakneš z vlečenjem ali klikom na zemljevid; koordinate lahko tudi prilepiš v polje spodaj."
        style={{
          height: "22rem",
          borderRadius: "var(--style-radius-m)",
          overflow: "hidden",
          border: "1px solid var(--theme-elevation-150)",
        }}
      />
      <dl style={{ display: "flex", flexWrap: "wrap", gap: "var(--base)", margin: 0 }}>
        <div>
          <dt className="field-label">Zemljepisna širina</dt>
          <dd style={{ margin: 0, fontVariantNumeric: "tabular-nums" }} aria-live="polite">
            {typeof lat.value === "number" ? lat.value.toFixed(6) : "—"}
          </dd>
        </div>
        <div>
          <dt className="field-label">Zemljepisna dolžina</dt>
          <dd style={{ margin: 0, fontVariantNumeric: "tabular-nums" }} aria-live="polite">
            {typeof lon.value === "number" ? lon.value.toFixed(6) : "—"}
          </dd>
        </div>
      </dl>
      {premaknjeno && (
        <p role="status" style={{ margin: 0, color: "var(--theme-warning-750)" }}>
          Lokacija je spremenjena. Po shranjevanju bo trasa etape tega obeležja zastarela, dokler je ne izračunaš znova
          (Vsebina → Trase → »Ponovno izračunaj trase«).
        </p>
      )}
      {!onemogoceno && (
        <div style={{ display: "grid", gap: "calc(var(--base) * 0.25)" }}>
          <label className="field-label" htmlFor="lokacija-prilepi">
            Prilepi koordinate
          </label>
          <div style={{ display: "flex", gap: "calc(var(--base) * 0.5)", flexWrap: "wrap" }}>
            <input
              id="lokacija-prilepi"
              type="text"
              inputMode="decimal"
              value={vnos}
              placeholder="45.799489, 15.156234"
              onChange={(e) => setVnos(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  prilepi();
                }
              }}
              style={{ flex: "1 1 16rem", minWidth: 0 }}
              aria-describedby="lokacija-prilepi-opis"
            />
            <button type="button" className="btn btn--style-secondary btn--size-small" style={{ margin: 0 }} onClick={prilepi}>
              Premakni žebljiček
            </button>
          </div>
          <span id="lokacija-prilepi-opis">
            <FieldDescription
              path="lokacija_prilepi"
              description="Najprej širina, nato dolžina, kot jih pokaže telefon ali Google Zemljevidi. Decimalna pika ali vejica."
            />
          </span>
          {sporocilo && (
            <p
              role={sporocilo.vrsta === "napaka" ? "alert" : "status"}
              style={{
                margin: 0,
                color: sporocilo.vrsta === "napaka" ? "var(--theme-error-750)" : "var(--theme-success-750)",
              }}
            >
              {sporocilo.besedilo}
            </p>
          )}
        </div>
      )}
      {(lat.showError || lon.showError) && (
        <p role="alert" style={{ margin: 0, color: "var(--theme-error-750)" }}>
          Obeležje potrebuje lokacijo — postavi žebljiček na zemljevid.
        </p>
      )}
    </div>
  );
}
