"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Map as MaplibreMap,
  LngLatBounds,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type DataDrivenPropertyValueSpecification,
  type ExpressionSpecification,
  type FilterSpecification,
  type GeoJSONSource,
  type MapGeoJSONFeature,
  type MapLayerMouseEvent,
  type MapMouseEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// maplibre-gl can't derive a working worker URL from inside a webpack
// bundle (see scripts/copy-maplibre-worker.mjs for why) — point it at the
// copy we serve from public/ before the first map is created.
if (typeof window !== "undefined") {
  setWorkerUrl(new URL("/maplibre-gl-worker.mjs", window.location.origin).href);
}
import type { Etapa, Pot, Tocka } from "@/lib/types";
import { findEtapa, getEtapaBarva } from "@/lib/etape";
import { barvaZetona } from "@/lib/mapBarve";
import { ensureVrstaIcons, vrstaIconImageId } from "@/lib/mapIcons";
import { buildPotPopupElement, buildTockaPopupElement, type TockaPopupHandle } from "@/lib/mapPopups";
import { isRazsirjeniKrak } from "@/lib/filters";
import { koordinateOdsekov, statusOdsekov, vidniOdseki, SPOROCILO_ZICA, type Obroc } from "@/lib/trasaIzris";
import { lineLengthMeters } from "@/lib/geo";
import { VSE_VRSTE } from "@/lib/vrsta";
import { messageForError, planWalkingRoute, type RouteState } from "@/lib/routing";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const NOVO_MESTO_CENTER: [number, number] = [15.1687, 45.8016];

/** Stage line widths (px): normal, emphasised (its point/trail is selected), faded. */
const SIRINA = { osnovna: 4, poudarjena: 6.5, zbledela: 3 } as const;
/** Off-white casing around every stage line: keeps the stage colours legible on the base tiles in sunlight. */
const OBROBA = 3;

/** Layers that carry stage lines, bottom to top. */
const PLASTI_ETAP = ["poti-etape-obroba", "poti-etape-izracunano", "poti-etape-shematsko"] as const;

interface MapViewProps {
  points: Tocka[];
  visiblePoints: Tocka[];
  poti: Pot[];
  etape: Etapa[];
  /** The stage ring (routed where cached, schematic elsewhere) — see lib/trasaIzris.ts. */
  obroc: Obroc;
  /** Selected stage IDs from the URL; empty = all stages. */
  izbraneEtapaIds: string[];
  /** The stage whose line is emphasised: the selected point's stage, or the selected trail. */
  poudarjenaEtapaId: string | null;
  /** Walking-order numbers to show on markers (only when exactly one stage is selected), by point ID. */
  zaporedneStevilke: Map<string, number> | null;
  selectedTockaId: string | null;
  selectedPotSlug: string | null;
  prefersReducedMotion: boolean;
  onSelectTocka: (id: string | null) => void;
  onSelectPot: (slug: string | null) => void;
  /** "Prikaži obrambni obroč 1942–43" toggle — off by default (Phase 3). */
  zicaVidna: boolean;
  /** Which point (if any) the active "Pelji me tja" route belongs to — used only to know when to clear the drawn line; drawing itself happens imperatively from the popup click handler. */
  routeTockaId: string | null;
  onRouteChange: (state: RouteState) => void;
}

/**
 * The personal "Pelji me tja" route: dark round dots on an off-white
 * casing. Deliberately unlike any stage line (solid or long-dashed, in a
 * stage colour) so the two routes on screen can never be confused.
 */
function drawAktivnaPot(map: MaplibreMap, geometry: GeoJSON.LineString) {
  const feature: GeoJSON.Feature<GeoJSON.LineString> = { type: "Feature", properties: {}, geometry };
  const source = map.getSource("aktivna-pot") as GeoJSONSource | undefined;
  if (source) {
    source.setData(feature);
    return;
  }
  map.addSource("aktivna-pot", { type: "geojson", data: feature });
  // Above the stage lines, below the markers.
  const beforeId = map.getLayer("clusters") ? "clusters" : undefined;
  map.addLayer(
    {
      id: "aktivna-pot-casing",
      type: "line",
      source: "aktivna-pot",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": barvaZetona("offwhite-50"), "line-width": 9, "line-opacity": 0.9 },
    },
    beforeId,
  );
  map.addLayer(
    {
      id: "aktivna-pot-line",
      type: "line",
      source: "aktivna-pot",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": barvaZetona("charcoal-900"), "line-width": 5, "line-dasharray": [0, 2] },
    },
    beforeId,
  );
}

function clearAktivnaPot(map: MaplibreMap) {
  if (map.getLayer("aktivna-pot-line")) map.removeLayer("aktivna-pot-line");
  if (map.getLayer("aktivna-pot-casing")) map.removeLayer("aktivna-pot-casing");
  if (map.getSource("aktivna-pot")) map.removeSource("aktivna-pot");
}

/**
 * The stage colour travels on the feature itself (resolved from the live
 * `etape` list), so no layer needs a per-stage match expression and
 * editor-defined stages/colours just work.
 */
function tockaToFeature(t: Tocka, etape: Etapa[], stevilke: Map<string, number> | null): GeoJSON.Feature<GeoJSON.Point> {
  const zaporedna = stevilke?.get(t.id);
  return {
    type: "Feature",
    properties: {
      id: t.id,
      etapa: t.etapa,
      barva: getEtapaBarva(etape, t.etapa),
      vrsta: t.vrsta,
      naziv: t.naziv,
      ...(zaporedna !== undefined ? { zaporedna } : {}),
    },
    geometry: { type: "Point", coordinates: [t.lon, t.lat] },
  };
}

/** One feature per part of each stage's section, coloured by its stage. */
function obrocToFeatures(obroc: Obroc, etape: Etapa[]): GeoJSON.FeatureCollection<GeoJSON.LineString> {
  return {
    type: "FeatureCollection",
    features: obroc.odseki.flatMap((o) =>
      o.deli.map((d) => ({
        type: "Feature" as const,
        properties: { etapaId: o.etapaId, vrsta: d.vrsta, barva: getEtapaBarva(etape, o.etapaId) },
        geometry: { type: "LineString" as const, coordinates: d.coordinates },
      })),
    ),
  };
}

function filterEtap(vrsta: "izracunano" | "shematsko" | null, izbrane: string[]): FilterSpecification {
  const pogoji: ExpressionSpecification[] = [];
  if (vrsta) pogoji.push(["==", ["get", "vrsta"], vrsta]);
  if (izbrane.length > 0) pogoji.push(["in", ["get", "etapaId"], ["literal", izbrane]]);
  return ["all", ...pogoji];
}

function poPoudarku(poudarjena: string | null, da: number, ne: number, sicer: number): DataDrivenPropertyValueSpecification<number> {
  return poudarjena ? ["case", ["==", ["get", "etapaId"], poudarjena], da, ne] : sicer;
}

/**
 * Cluster ring colour = the stage most of its points belong to. Counts per
 * stage are accumulated by clusterProperties; built from the live stage
 * list, so no stage colour or count is hardcoded.
 */
function clusterProperties(etape: Etapa[]): Record<string, unknown> {
  return Object.fromEntries(etape.map((e, i) => [`n${i}`, ["+", ["case", ["==", ["get", "etapa"], e.id], 1, 0]]]));
}

function clusterBarva(etape: Etapa[]): DataDrivenPropertyValueSpecification<string> {
  const fallback = barvaZetona("offwhite-50");
  if (etape.length === 0) return fallback;
  const veje = etape.flatMap((e, i) => {
    const primerjave = etape.flatMap((_, j) => (j === i ? [] : [[">=", ["get", `n${i}`], ["get", `n${j}`]]]));
    return [["all", ...primerjave], e.barva];
  });
  return ["case", ...veje, fallback] as unknown as ExpressionSpecification;
}

/**
 * Fit padding that keeps the fitted area clear of the map chrome: the
 * status badge on top and, on phones, the bottom sheet (peek height ≈ 28vh).
 */
function odmikPogleda(map: MaplibreMap) {
  const { clientWidth: w, clientHeight: h } = map.getContainer();
  if (w < 768) return { top: 72, bottom: Math.round(h * 0.3) + 16, left: 24, right: 24 };
  return { top: 72, bottom: 48, left: 48, right: 48 };
}

/** Phones: the bottom sheet covers the lower map, so point popups open upwards. */
function jeTelefon(map: MaplibreMap): boolean {
  return map.getContainer().clientWidth < 768;
}

/**
 * Where a selected point is brought into view. On a phone it goes low in
 * the strip between the status badge and the bottom sheet, leaving room
 * above it for the popup (anchored at its bottom).
 */
function odmikZaTocko(map: MaplibreMap) {
  if (!jeTelefon(map)) return odmikPogleda(map);
  const h = map.getContainer().clientHeight;
  const spodaj = Math.round(h * 0.3) + 24;
  return { top: Math.max(72, h - spodaj - 70), bottom: spodaj, left: 24, right: 24 };
}

function extendBounds(bounds: LngLatBounds | null, coords: [number, number][]): LngLatBounds | null {
  let b = bounds;
  for (const c of coords) b = b ? b.extend(c) : new LngLatBounds(c, c);
  return b;
}

export default function MapView({
  points,
  visiblePoints,
  poti,
  etape,
  obroc,
  izbraneEtapaIds,
  poudarjenaEtapaId,
  zaporedneStevilke,
  selectedTockaId,
  selectedPotSlug,
  prefersReducedMotion,
  onSelectTocka,
  onSelectPot,
  zicaVidna,
  routeTockaId,
  onRouteChange,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const popupRef = useRef<Popup | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showFitAllButton, setShowFitAllButton] = useState(false);

  // Latest props for the one-time load handler (it must not re-run, but
  // should start from whatever the URL already selects).
  const latest = useRef({ visiblePoints, etape, obroc, izbraneEtapaIds, zaporedneStevilke, poti, zicaVidna });
  useEffect(() => {
    latest.current = { visiblePoints, etape, obroc, izbraneEtapaIds, zaporedneStevilke, poti, zicaVidna };
  });

  /**
   * Bounds of what the stage filter shows: its line sections and its
   * visible on-trail points. Extended-branch points sit kilometres out and
   * would shrink the line to a speck on a phone; "prikaži vseh" reaches them.
   */
  const boundsIzbranih = useCallback((): LngLatBounds | null => {
    const { obroc: o, izbraneEtapaIds: izbrane, visiblePoints: vidne } = latest.current;
    const b = extendBounds(null, koordinateOdsekov(vidniOdseki(o, izbrane)));
    return extendBounds(b, vidne.filter((p) => !isRazsirjeniKrak(p)).map((p): [number, number] => [p.lon, p.lat]));
  }, []);

  // --- One-time map setup -----------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MaplibreMap({
      container: containerRef.current,
      style: STYLE_URL,
      center: NOVO_MESTO_CENTER,
      zoom: 13,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      void (async () => {
        await ensureVrstaIcons(map, VSE_VRSTE);
        const start = latest.current;
        const offwhite = barvaZetona("offwhite-50");

        // --- Stage ring: casing beneath, then routed (solid) and schematic (long dashes) --
        map.addSource("poti-etape", { type: "geojson", data: obrocToFeatures(start.obroc, start.etape) });
        map.addLayer({
          id: "poti-etape-obroba",
          type: "line",
          source: "poti-etape",
          filter: filterEtap(null, start.izbraneEtapaIds),
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": offwhite, "line-width": SIRINA.osnovna + OBROBA, "line-opacity": 0.9 },
        });
        map.addLayer({
          id: "poti-etape-izracunano",
          type: "line",
          source: "poti-etape",
          filter: filterEtap("izracunano", start.izbraneEtapaIds),
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": ["get", "barva"], "line-width": SIRINA.osnovna },
        });
        map.addLayer({
          id: "poti-etape-shematsko",
          type: "line",
          source: "poti-etape",
          filter: filterEtap("shematsko", start.izbraneEtapaIds),
          // Butt caps: round caps would fill the dash gaps back in.
          layout: { "line-cap": "butt", "line-join": "round" },
          paint: { "line-color": ["get", "barva"], "line-width": SIRINA.osnovna, "line-dasharray": [2.5, 1.2] },
        });

        // --- The 1943 wire, its own source and colour ------------------------
        const zica = start.poti.find((p) => p.vrsta === "zica");
        if (zica) {
          map.addSource("poti-zica", {
            type: "geojson",
            data: { type: "Feature", properties: { slug: zica.slug, barva: zica.barva }, geometry: zica.geometry },
          });
          map.addLayer({
            id: "poti-zica-line",
            type: "line",
            source: "poti-zica",
            layout: { "line-cap": "round", "line-join": "round", visibility: start.zicaVidna ? "visible" : "none" },
            paint: { "line-color": ["get", "barva"], "line-width": 3, "line-opacity": 0.9, "line-dasharray": [1, 1.6] },
          });
        }

        // --- Points: clustered source ------------------------------------
        map.addSource("tocke", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: start.visiblePoints.map((t) => tockaToFeature(t, start.etape, start.zaporedneStevilke)),
          },
          // One stage shown = a handful of points: never clustered, so the
          // walking-order numbers stay visible at any zoom.
          cluster: start.zaporedneStevilke === null,
          clusterRadius: 50,
          clusterMaxZoom: 13,
          clusterProperties: clusterProperties(start.etape),
        });

        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "tocke",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": barvaZetona("charcoal-900"),
            "circle-stroke-color": clusterBarva(start.etape),
            "circle-stroke-width": 4,
            "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 25, 26],
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "tocke",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-font": ["Noto Sans Bold"],
            "text-size": 13,
          },
          paint: { "text-color": offwhite },
        });

        map.addLayer({
          id: "tocka-krogec",
          type: "circle",
          source: "tocke",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": ["get", "barva"],
            "circle-radius": 13,
            "circle-stroke-color": offwhite,
            "circle-stroke-width": 1.5,
          },
        });
        map.addLayer({
          id: "tocka-ikona",
          type: "symbol",
          source: "tocke",
          filter: ["!", ["has", "point_count"]],
          layout: {
            "icon-image": [
              "match",
              ["get", "vrsta"],
              ...VSE_VRSTE.flatMap((v) => [v, vrstaIconImageId(v)]),
              vrstaIconImageId("plosca"),
            ] as unknown as ExpressionSpecification,
            "icon-size": 0.16,
            "icon-allow-overlap": true,
          },
        });

        // --- Walking-order badge (exactly one stage selected) ---------------
        const imaStevilko: FilterSpecification = ["all", ["!", ["has", "point_count"]], ["has", "zaporedna"]];
        map.addLayer({
          id: "tocka-stevilka-ozadje",
          type: "circle",
          source: "tocke",
          filter: imaStevilko,
          paint: {
            "circle-radius": 9,
            "circle-color": barvaZetona("charcoal-950"),
            "circle-stroke-color": offwhite,
            "circle-stroke-width": 1.5,
            "circle-translate": [12, -12],
          },
        });
        map.addLayer({
          id: "tocka-stevilka",
          type: "symbol",
          source: "tocke",
          filter: imaStevilko,
          layout: {
            "text-field": ["to-string", ["get", "zaporedna"]],
            "text-font": ["Noto Sans Bold"],
            "text-size": 11,
            "text-allow-overlap": true,
            "text-ignore-placement": true,
          },
          paint: { "text-color": offwhite, "text-translate": [12, -12] },
        });

        // --- Selection highlight ring -------------------------------------
        map.addSource("tocka-izbrana", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addLayer({
          id: "tocka-izbrana-obroc",
          type: "circle",
          source: "tocka-izbrana",
          paint: {
            "circle-radius": 19,
            "circle-color": "transparent",
            "circle-stroke-color": barvaZetona("accent-red"),
            "circle-stroke-width": 3,
          },
        });

        // --- Interaction ----------------------------------------------------
        const lineLayers = ["poti-etape-izracunano", "poti-etape-shematsko", "poti-zica-line"];
        const interactiveLayers = ["clusters", "tocka-krogec", "tocka-ikona", ...lineLayers].filter((l) => map.getLayer(l));
        for (const layer of interactiveLayers) {
          map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
        }

        map.on("click", "clusters", (e: MapLayerMouseEvent) => {
          const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
          const clusterId = features[0]?.properties?.cluster_id;
          const source = map.getSource("tocke") as GeoJSONSource;
          const clusterFeature = features[0];
          if (clusterId === undefined || !clusterFeature) return;
          void source.getClusterExpansionZoom(clusterId).then((zoom) => {
            const coords = (clusterFeature.geometry as GeoJSON.Point).coordinates as [number, number];
            map.easeTo({ center: coords, zoom, duration: prefersReducedMotion ? 0 : 400 });
          });
        });

        // One handler decides: a marker sits on top of a line, and one click
        // must make one selection — the point wins (its stage is then
        // emphasised through the point's own state).
        map.on("click", (e: MapMouseEvent) => {
          const hits = map.queryRenderedFeatures(e.point, { layers: interactiveLayers });
          const tocka = hits.find((f: MapGeoJSONFeature) => f.layer.id === "tocka-krogec" || f.layer.id === "tocka-ikona");
          if (tocka) {
            const id = tocka.properties?.id as string | undefined;
            if (id) onSelectTocka(id);
            return;
          }
          if (hits.some((f) => f.layer.id === "clusters")) return;
          const linija = hits.find((f) => lineLayers.includes(f.layer.id));
          if (linija) {
            const slug = (linija.properties?.etapaId ?? linija.properties?.slug) as string | undefined;
            if (slug) onSelectPot(slug);
            return;
          }
          // Empty map: clear the selection. The stage filter lives in the URL and stays.
          onSelectTocka(null);
        });

        // --- Initial fit: never a world view. The whole ring, or the selection. --
        const bounds = boundsIzbranih();
        if (bounds) map.fitBounds(bounds, { padding: odmikPogleda(map), animate: false });
        if (points.some(isRazsirjeniKrak)) setShowFitAllButton(true);

        setLoaded(true);
      })();
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map is created once; data updates flow through the effects below
  }, []);

  // --- Stage ring data (a recolour or new routes arrive as new props) ------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    (map.getSource("poti-etape") as GeoJSONSource | undefined)?.setData(obrocToFeatures(obroc, etape));
    map.setPaintProperty("clusters", "circle-stroke-color", clusterBarva(etape));
  }, [loaded, obroc, etape]);

  // --- Which stages show, and which one is emphasised ----------------------
  const izbraneKljuc = izbraneEtapaIds.join(",");
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const izbrane = izbraneKljuc ? izbraneKljuc.split(",") : [];
    map.setFilter("poti-etape-obroba", filterEtap(null, izbrane));
    map.setFilter("poti-etape-izracunano", filterEtap("izracunano", izbrane));
    map.setFilter("poti-etape-shematsko", filterEtap("shematsko", izbrane));

    const p = poudarjenaEtapaId;
    const s = SIRINA;
    map.setPaintProperty("poti-etape-obroba", "line-width", poPoudarku(p, s.poudarjena + OBROBA, s.zbledela + OBROBA, s.osnovna + OBROBA));
    map.setPaintProperty("poti-etape-obroba", "line-opacity", poPoudarku(p, 0.95, 0.35, 0.9));
    for (const id of ["poti-etape-izracunano", "poti-etape-shematsko"]) {
      map.setPaintProperty(id, "line-width", poPoudarku(p, s.poudarjena, s.zbledela, s.osnovna));
      map.setPaintProperty(id, "line-opacity", poPoudarku(p, 1, 0.35, 1));
    }
    // The emphasised stage is drawn above its neighbours at the joints.
    for (const id of PLASTI_ETAP) {
      map.setLayoutProperty(id, "line-sort-key", p ? ["case", ["==", ["get", "etapaId"], p], 1, 0] : 0);
    }
  }, [loaded, izbraneKljuc, poudarjenaEtapaId]);

  // --- Selecting stages brings them into view (the first load fits on its own) --
  const prejsnjiIzbor = useRef<string | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    if (prejsnjiIzbor.current === null || prejsnjiIzbor.current === izbraneKljuc) {
      prejsnjiIzbor.current = izbraneKljuc;
      return;
    }
    prejsnjiIzbor.current = izbraneKljuc;
    const bounds = boundsIzbranih();
    if (bounds) map.fitBounds(bounds, { padding: odmikPogleda(map), animate: !prefersReducedMotion, duration: 500, maxZoom: 16 });
  }, [loaded, izbraneKljuc, prefersReducedMotion, boundsIzbranih]);

  // --- Keep the points source in sync with active filters -----------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const source = map.getSource("tocke") as GeoJSONSource | undefined;
    void source?.setClusterOptions({ cluster: zaporedneStevilke === null, clusterRadius: 50, clusterMaxZoom: 13 });
    source?.setData({
      type: "FeatureCollection",
      features: visiblePoints.map((t) => tockaToFeature(t, etape, zaporedneStevilke)),
    });
  }, [loaded, visiblePoints, etape, zaporedneStevilke]);

  // --- Selected point: highlight ring + fly-to -----------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    const highlightSource = map.getSource("tocka-izbrana") as GeoJSONSource | undefined;
    const tocka = selectedTockaId ? points.find((p) => p.id === selectedTockaId) : undefined;
    highlightSource?.setData({
      type: "FeatureCollection",
      features: tocka ? [tockaToFeature(tocka, etape, null)] : [],
    });
    if (tocka) {
      const opts = {
        center: [tocka.lon, tocka.lat] as [number, number],
        zoom: Math.max(map.getZoom(), 15),
        padding: odmikZaTocko(map),
      };
      if (prefersReducedMotion) map.jumpTo(opts);
      else map.easeTo({ ...opts, duration: 600 });
    }
  }, [loaded, selectedTockaId, points, etape, prefersReducedMotion]);

  // --- Selected trail: fly to its bounds; the wire layer's visibility ------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    const isZica = selectedPotSlug === "zica-1943" || zicaVidna;
    if (map.getLayer("poti-zica-line")) {
      map.setLayoutProperty("poti-zica-line", "visibility", isZica ? "visible" : "none");
    }

    if (!selectedPotSlug) return;
    const odsek = vidniOdseki(obroc, [selectedPotSlug]);
    const coords =
      odsek.length > 0 ? koordinateOdsekov(odsek) : (poti.find((p) => p.slug === selectedPotSlug)?.geometry.coordinates ?? []);
    const bounds = extendBounds(null, coords);
    if (bounds) map.fitBounds(bounds, { padding: odmikPogleda(map), animate: !prefersReducedMotion, duration: 600 });
  }, [loaded, selectedPotSlug, obroc, poti, prefersReducedMotion, zicaVidna]);

  // --- "Pelji me tja" from a marker popup: geolocate, fetch the route,
  // draw it, and lift the result up so the side panel can show
  // distance/duration/turn instructions. ---------------------------------
  const handlePeljiMeTja = useCallback(
    async (tocka: Tocka, handle: TockaPopupHandle) => {
      onRouteChange({ status: "loading", tocka });
      handle.peljiButton.disabled = true;
      handle.peljiButton.textContent = "Iščem lokacijo …";
      try {
        const route = await planWalkingRoute({ lat: tocka.lat, lon: tocka.lon });
        if (mapRef.current) drawAktivnaPot(mapRef.current, route.geometry);
        handle.peljiButton.textContent = "Pot najdena ✓";
        onRouteChange({ status: "ready", tocka, route });
      } catch (err) {
        const msg = messageForError(err);
        handle.peljiButton.textContent = msg;
        handle.peljiButton.disabled = false;
        onRouteChange({ status: "error", tocka, error: msg });
      }
    },
    [onRouteChange],
  );

  // Clears the drawn route once the panel/caller says it's no longer active
  // (e.g. "Prekliči navigacijo"). Drawing itself is imperative, from the
  // click handler above, not driven by a prop — only clearing is reactive.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;
    if (!routeTockaId) clearAktivnaPot(map);
  }, [loaded, routeTockaId]);

  // --- Popup: one effect deciding for BOTH selection kinds together, so a
  // tocka popup and a pot popup can never race to remove each other's ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded) return;

    popupRef.current?.remove();
    popupRef.current = null;

    if (selectedTockaId) {
      const tocka = points.find((p) => p.id === selectedTockaId);
      if (tocka) {
        const etapa = findEtapa(etape, tocka.etapa);
        const odsek = etapa ? vidniOdseki(obroc, [etapa.id]) : [];
        const legenda = etapa
          ? { naziv: etapa.naziv, barva: etapa.barva, shematsko: statusOdsekov(odsek)?.status !== "izracunano" }
          : null;
        const handle = buildTockaPopupElement(tocka, legenda, () => handlePeljiMeTja(tocka, handle));
        popupRef.current = new Popup({
          closeButton: false,
          closeOnClick: false,
          maxWidth: "280px",
          offset: 16,
          ...(jeTelefon(map) ? { anchor: "bottom" as const } : {}),
        })
          .setLngLat([tocka.lon, tocka.lat])
          .setDOMContent(handle.root)
          .addTo(map);
      }
    } else if (selectedPotSlug) {
      const pot = poti.find((p) => p.slug === selectedPotSlug);
      if (pot) {
        const odsek = vidniOdseki(obroc, [pot.slug]);
        const coords = odsek.length > 0 ? koordinateOdsekov(odsek) : pot.geometry.coordinates;
        const sporocilo = pot.vrsta === "zica" ? SPOROCILO_ZICA : (statusOdsekov(odsek)?.sporocilo ?? null);
        const anchor = coords[Math.floor(coords.length / 2)];
        if (anchor) {
          popupRef.current = new Popup({ closeButton: false, closeOnClick: false, maxWidth: "260px" })
            .setLngLat(anchor)
            .setDOMContent(buildPotPopupElement(pot, pot.tocke_ids.length, lineLengthMeters(coords), sporocilo))
            .addTo(map);
        }
      }
    }
  }, [loaded, selectedTockaId, selectedPotSlug, points, poti, etape, obroc, handlePeljiMeTja]);

  function handleFitAll() {
    const map = mapRef.current;
    if (!map) return;
    const bounds = extendBounds(null, points.map((p): [number, number] => [p.lon, p.lat]));
    if (bounds) map.fitBounds(bounds, { padding: odmikPogleda(map), animate: !prefersReducedMotion });
    setShowFitAllButton(false);
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {showFitAllButton && (
        <button
          type="button"
          onClick={handleFitAll}
          className="map-chrome absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-sm font-medium shadow-lg"
        >
          Obeležja zunaj kadra — prikaži vseh {points.length}
        </button>
      )}
    </div>
  );
}
