"use client";

/**
 * Small, mostly-static context map for detail pages — NOT the full
 * MapView (no clustering, no filters, no shared selection state). Two
 * variants: a single point in its surroundings (/tocka/[slug]), or a
 * trail's line with its points in walking order (/pot/[slug]).
 */

import { useEffect, useRef } from "react";
import { Map as MaplibreMap, Marker, LngLatBounds, NavigationControl, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Pot, Tocka } from "@/lib/types";
import { getEtapaBarva } from "@/lib/etape";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

if (typeof window !== "undefined") {
  setWorkerUrl(new URL("/maplibre-gl-worker.mjs", window.location.origin).href);
}

type MiniMapProps = { variant: "tocka"; tocka: Tocka } | { variant: "pot"; pot: Pot; tocke: Tocka[] };

export default function MiniMap(props: MiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    const markers: Marker[] = [];

    map.on("load", () => {
      if (props.variant === "tocka") {
        markers.push(
          new Marker({ color: getEtapaBarva(props.tocka.etapa) })
            .setLngLat([props.tocka.lon, props.tocka.lat])
            .addTo(map),
        );
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
    });

    return () => {
      markers.forEach((m) => m.remove());
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- built once from initial props; detail pages don't mutate these mid-view
  }, []);

  return <div ref={containerRef} className="h-full w-full" />;
}
