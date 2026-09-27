"use client";

import { useEffect, useRef, useState } from "react";
import {
  Map as MaplibreMap,
  LngLatBounds,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
  type LngLatBoundsLike,
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
import type { Pot, Tocka } from "@/lib/types";
import { getEtapaBarva } from "@/lib/etape";
import { ensureVrstaIcons, vrstaIconImageId } from "@/lib/mapIcons";
import { isRazsirjeniKrak } from "@/lib/filters";
import { VSE_VRSTE } from "@/lib/vrsta";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const NOVO_MESTO_CENTER: [number, number] = [15.1687, 45.8016];

interface MapViewProps {
  points: Tocka[];
  visiblePoints: Tocka[];
  poti: Pot[];
  selectedTockaId: string | null;
  selectedPotSlug: string | null;
  prefersReducedMotion: boolean;
  onSelectTocka: (id: string | null) => void;
  onSelectPot: (slug: string | null) => void;
}

function tockaToFeature(t: Tocka): GeoJSON.Feature<GeoJSON.Point> {
  return {
    type: "Feature",
    properties: { id: t.id, etapa: t.etapa, vrsta: t.vrsta, naziv: t.naziv },
    geometry: { type: "Point", coordinates: [t.lon, t.lat] },
  };
}

function boundsFromPoints(points: Tocka[]): LngLatBoundsLike | null {
  if (points.length === 0) return null;
  const bounds = new LngLatBounds();
  for (const p of points) bounds.extend([p.lon, p.lat]);
  return bounds;
}

export default function MapView({
  points,
  visiblePoints,
  poti,
  selectedTockaId,
  selectedPotSlug,
  prefersReducedMotion,
  onSelectTocka,
  onSelectPot,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const loadedRef = useRef(false);
  const [showFitAllButton, setShowFitAllButton] = useState(false);

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

        // --- Trails: 8 etapa lines in one source, zica-1943 in its own --
        const etapaLines: GeoJSON.Feature<GeoJSON.LineString>[] = [];
        let zicaLine: GeoJSON.Feature<GeoJSON.LineString> | null = null;
        for (const pot of poti) {
          const feature: GeoJSON.Feature<GeoJSON.LineString> = {
            type: "Feature",
            properties: { slug: pot.slug, naziv: pot.naziv, barva: pot.barva, status: pot.status },
            geometry: pot.geometry,
          };
          if (pot.vrsta === "zica") zicaLine = feature;
          else etapaLines.push(feature);
        }

        map.addSource("poti-etape", { type: "geojson", data: { type: "FeatureCollection", features: etapaLines } });
        map.addLayer({
          id: "poti-etape-line",
          type: "line",
          source: "poti-etape",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": ["get", "barva"],
            "line-width": 2.5,
            "line-opacity": 1,
            "line-dasharray": [2, 1.6],
          },
        });

        if (zicaLine) {
          map.addSource("poti-zica", { type: "geojson", data: { type: "FeatureCollection", features: [zicaLine] } });
          map.addLayer({
            id: "poti-zica-line",
            type: "line",
            source: "poti-zica",
            layout: { "line-cap": "round", "line-join": "round", visibility: "none" },
            paint: { "line-color": ["get", "barva"], "line-width": 3, "line-opacity": 0.9, "line-dasharray": [1, 1.6] },
          });
        }

        // --- Points: clustered source ------------------------------------
        map.addSource("tocke", {
          type: "geojson",
          data: { type: "FeatureCollection", features: visiblePoints.map(tockaToFeature) },
          cluster: true,
          clusterRadius: 50,
          clusterMaxZoom: 13,
        });

        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "tocke",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#1c2024",
            "circle-stroke-color": "#faf8f4",
            "circle-stroke-width": 2,
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
          paint: { "text-color": "#faf8f4" },
        });

        map.addLayer({
          id: "tocka-krogec",
          type: "circle",
          source: "tocke",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": [
              "match",
              ["get", "etapa"],
              1, getEtapaBarva(1),
              2, getEtapaBarva(2),
              3, getEtapaBarva(3),
              4, getEtapaBarva(4),
              5, getEtapaBarva(5),
              6, getEtapaBarva(6),
              7, getEtapaBarva(7),
              8, getEtapaBarva(8),
              "#888888",
            ],
            "circle-radius": 13,
            "circle-stroke-color": "#faf8f4",
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
              "plosca",
              vrstaIconImageId("plosca"),
              "spomenik",
              vrstaIconImageId("spomenik"),
              "grobnica",
              vrstaIconImageId("grobnica"),
              "bunker",
              vrstaIconImageId("bunker"),
              "kompleks",
              vrstaIconImageId("kompleks"),
              "muzej",
              vrstaIconImageId("muzej"),
              "kraj-dogodka",
              vrstaIconImageId("kraj-dogodka"),
              vrstaIconImageId("plosca"),
            ],
            "icon-size": 0.16,
            "icon-allow-overlap": true,
          },
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
            "circle-stroke-color": "#a13d3d",
            "circle-stroke-width": 3,
          },
        });

        // --- Interaction ----------------------------------------------------
        const interactiveLayers = ["clusters", "tocka-krogec", "tocka-ikona", "poti-etape-line", "poti-zica-line"];
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

        function handlePointClick(features: MapGeoJSONFeature[] | undefined) {
          const id = features?.[0]?.properties?.id as string | undefined;
          if (id) onSelectTocka(id);
        }
        map.on("click", "tocka-krogec", (e: MapLayerMouseEvent) => handlePointClick(e.features));
        map.on("click", "tocka-ikona", (e: MapLayerMouseEvent) => handlePointClick(e.features));

        map.on("click", "poti-etape-line", (e: MapLayerMouseEvent) => {
          const slug = e.features?.[0]?.properties?.slug as string | undefined;
          if (slug) onSelectPot(slug);
        });
        map.on("click", "poti-zica-line", (e: MapLayerMouseEvent) => {
          const slug = e.features?.[0]?.properties?.slug as string | undefined;
          if (slug) onSelectPot(slug);
        });

        map.on("click", (e: MapMouseEvent) => {
          const hits = map.queryRenderedFeatures(e.point, { layers: interactiveLayers });
          if (hits.length === 0) {
            onSelectTocka(null);
            onSelectPot(null);
          }
        });

        // --- Initial fit: 35 core/nearby points, not the 15 extended-branch --
        const coreBounds = boundsFromPoints(points.filter((p) => !isRazsirjeniKrak(p)));
        if (coreBounds) map.fitBounds(coreBounds, { padding: 48, animate: false });
        const krakCount = points.filter(isRazsirjeniKrak).length;
        if (krakCount > 0) setShowFitAllButton(true);

        loadedRef.current = true;
      })();
    });

    return () => {
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map is created once; data updates flow through the effects below
  }, []);

  // --- Keep the points source in sync with active filters -----------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const source = map.getSource("tocke") as GeoJSONSource | undefined;
    source?.setData({ type: "FeatureCollection", features: visiblePoints.map(tockaToFeature) });
  }, [visiblePoints]);

  // --- Selected point: highlight ring + fly-to -----------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const highlightSource = map.getSource("tocka-izbrana") as GeoJSONSource | undefined;
    const tocka = selectedTockaId ? points.find((p) => p.id === selectedTockaId) : undefined;
    highlightSource?.setData({
      type: "FeatureCollection",
      features: tocka ? [tockaToFeature(tocka)] : [],
    });
    if (tocka) {
      const opts = { center: [tocka.lon, tocka.lat] as [number, number], zoom: Math.max(map.getZoom(), 15) };
      if (prefersReducedMotion) map.jumpTo(opts);
      else map.easeTo({ ...opts, duration: 600 });
    }
  }, [selectedTockaId, points, prefersReducedMotion]);

  // --- Selected trail: bold it, fade the rest, fly to its bounds, reveal zica --
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;

    if (map.getLayer("poti-etape-line")) {
      map.setPaintProperty(
        "poti-etape-line",
        "line-width",
        selectedPotSlug ? ["match", ["get", "slug"], selectedPotSlug, 5, 2] : 2.5,
      );
      map.setPaintProperty(
        "poti-etape-line",
        "line-opacity",
        selectedPotSlug ? ["match", ["get", "slug"], selectedPotSlug, 1, 0.35] : 1,
      );
    }

    const isZica = selectedPotSlug === "zica-1943";
    if (map.getLayer("poti-zica-line")) {
      map.setLayoutProperty("poti-zica-line", "visibility", isZica ? "visible" : "none");
    }

    const pot = poti.find((p) => p.slug === selectedPotSlug);
    if (pot) {
      const bounds = pot.geometry.coordinates.reduce(
        (b, [lon, lat]) => b.extend([lon, lat]),
        new LngLatBounds(pot.geometry.coordinates[0], pot.geometry.coordinates[0]),
      );
      map.fitBounds(bounds, { padding: 64, animate: !prefersReducedMotion, duration: 600 });
    }
  }, [selectedPotSlug, poti, prefersReducedMotion]);

  function handleFitAll() {
    const map = mapRef.current;
    if (!map) return;
    const bounds = boundsFromPoints(points);
    if (bounds) map.fitBounds(bounds, { padding: 48, animate: !prefersReducedMotion });
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
          Obeležja zunaj kadra — prikaži vseh 50
        </button>
      )}
    </div>
  );
}

