"use client";

/**
 * Small, mostly-static context map for detail pages — NOT the full
 * MapView (no clustering, no filters, no shared selection state). Two
 * variants: a single point in its surroundings (/tocka/[slug]), optionally
 * with an active "Pelji me tja" route drawn on top; or a trail's line with
 * its points in walking order (/pot/[slug]).
 */

import { useEffect, useRef } from "react";
import { Map as MaplibreMap, Marker, LngLatBounds, NavigationControl, setWorkerUrl, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Pot, Tocka } from "@/lib/types";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const AKTIVNA_POT_BARVA = "#a13d3d";

if (typeof window !== "undefined") {
  setWorkerUrl(new URL("/maplibre-gl-worker.mjs", window.location.origin).href);
}

type MiniMapProps =
  | { variant: "tocka"; tocka: Tocka; barva: string; route?: GeoJSON.LineString | null }
  | { variant: "pot"; pot: Pot; tocke: Tocka[] };

export default function MiniMap(props: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MaplibreMap | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MaplibreMap({
      container: containerRef.current,
      style: STYLE_URL,
      center: props.variant === "tocka" ? [props.tocka.lon, props.tocka.lat] : [15.1687, 45.8016],
      zoom: 15,
      scrollZoom: false,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    const markers: Marker[] = [];

    map.on("load", () => {
      if (props.variant === "tocka") {
        markers.push(
          new Marker({ color: props.barva })
            .setLngLat([props.tocka.lon, props.tocka.lat])
            .addTo(map),
        );
        loadedRef.current = true;
        return;
      }

      const { pot, tocke } = props;
      map.addSource("pot-linija", {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: pot.geometry },
      });
      map.addLayer({
        id: "pot-linija-layer",
        type: "line",
        source: "pot-linija",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": pot.barva, "line-width": 3.5, "line-dasharray": [2, 1.6] },
      });

      tocke.forEach((t, i) => {
        const el = document.createElement("div");
        el.className =
          "flex h-6 w-6 items-center justify-center rounded-full border-2 border-offwhite-50 text-[11px] font-bold text-offwhite-50 shadow";
        el.style.backgroundColor = pot.barva;
        el.textContent = String(i + 1);
        markers.push(new Marker({ element: el }).setLngLat([t.lon, t.lat]).addTo(map));
      });

      if (pot.geometry.coordinates.length > 0) {
        const bounds = pot.geometry.coordinates.reduce(
          (b, [lon, lat]) => b.extend([lon, lat]),
          new LngLatBounds(pot.geometry.coordinates[0], pot.geometry.coordinates[0]),
        );
        map.fitBounds(bounds, { padding: 32, animate: false });
      }
      loadedRef.current = true;
    });

    return () => {
      markers.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- built once from initial props; only `route` (tocka variant) is meant to update live, handled in the effect below
  }, []);

  // Draws/updates/removes the active walking route on top of the point map.
  const route = props.variant === "tocka" ? (props.route ?? null) : null;
  useEffect(() => {
    if (props.variant !== "tocka") return;
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      if (!loadedRef.current) return;
      const source = map.getSource("aktivna-pot") as GeoJSONSource | undefined;
      if (!route) {
        if (map.getLayer("aktivna-pot-line")) map.removeLayer("aktivna-pot-line");
        if (map.getLayer("aktivna-pot-casing")) map.removeLayer("aktivna-pot-casing");
        if (source) map.removeSource("aktivna-pot");
        return;
      }
      const feature: GeoJSON.Feature<GeoJSON.LineString> = { type: "Feature", properties: {}, geometry: route };
      if (source) {
        source.setData(feature);
      } else {
        map.addSource("aktivna-pot", { type: "geojson", data: feature });
        map.addLayer({
          id: "aktivna-pot-casing",
          type: "line",
          source: "aktivna-pot",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#faf8f4", "line-width": 6, "line-opacity": 0.7 },
        });
        map.addLayer({
          id: "aktivna-pot-line",
          type: "line",
          source: "aktivna-pot",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": AKTIVNA_POT_BARVA, "line-width": 3.5, "line-dasharray": [0.1, 1.6] },
        });
      }
      const coords = route.coordinates as [number, number][];
      const bounds = coords.reduce((b, c) => b.extend(c), new LngLatBounds(coords[0]!, coords[0]!));
      map.fitBounds(bounds, { padding: 40, animate: true });
    };

    if (loadedRef.current) apply();
    else map.once("load", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `props.variant` is read only to early-return and never changes for a mounted instance; `route` is the real trigger
  }, [route]);

  return <div ref={containerRef} className="h-full w-full" />;
}
