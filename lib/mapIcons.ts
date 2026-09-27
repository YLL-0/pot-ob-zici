"use client";

/**
 * Rasterizes the lib/vrsta.ts lucide icons into MapLibre sprite images, so
 * the same icon used in the legend/filter chips also appears on the map
 * markers (colour = etapa via the circle layer beneath, icon = vrsta via
 * these images).
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Map as MaplibreMap } from "maplibre-gl";
import { VRSTA_ICONS } from "@/lib/vrsta";
import type { Vrsta } from "@/lib/types";

const ICON_SIZE = 96;
/** Off-white — matches --color-offwhite-50, reads clearly on any etapa colour. */
const ICON_COLOR = "#faf8f4";

export function vrstaIconImageId(vrsta: Vrsta): string {
  return `vrsta-icon-${vrsta}`;
}

function svgDataUri(vrsta: Vrsta): string {
  const Icon = VRSTA_ICONS[vrsta];
  const markup = renderToStaticMarkup(
    createElement(Icon, { color: ICON_COLOR, strokeWidth: 2.25, width: ICON_SIZE, height: ICON_SIZE }),
  );
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

/**
 * Rasterizes one SVG icon via a plain <img> + <canvas> (NOT
 * map.loadImage(): that routes through MapLibre's fetch/createImageBitmap
 * resource pipeline, which does not reliably decode `image/svg+xml` data
 * URIs — it's built for raster tile/sprite images). The <img>-element path
 * is the same one browsers use to paint inline SVGs, so it always works.
 */
function rasterizeSvg(dataUri: string, size: number): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("2D canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, size, size);
      resolve(ctx.getImageData(0, 0, size, size));
    };
    img.onerror = () => reject(new Error("SVG image failed to load"));
    img.src = dataUri;
  });
}

/**
 * Loads one raster icon per requested Vrsta into the map, skipping ones
 * already present. A single icon failing to decode must never take down
 * map init — markers still render (as plain etapa-coloured circles) with
 * no icon glyph rather than the whole map staying blank.
 */
export async function ensureVrstaIcons(map: MaplibreMap, vrste: Vrsta[]): Promise<void> {
  await Promise.all(
    vrste.map(async (vrsta) => {
      const id = vrstaIconImageId(vrsta);
      if (map.hasImage(id)) return;
      try {
        const imageData = await rasterizeSvg(svgDataUri(vrsta), ICON_SIZE);
        if (!map.hasImage(id)) map.addImage(id, imageData);
      } catch (err) {
        console.warn(`[mapIcons] Ikona za vrsto "${vrsta}" se ni naložila:`, err);
      }
    }),
  );
}
