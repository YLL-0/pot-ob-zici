"use client";

/**
 * Rasterizes the lib/vrsta.ts lucide icons into MapLibre sprite images, so
 * the same icon used in the legend/filter chips also appears on the map
 * markers (colour = etapa via the circle layer beneath, icon = vrsta via
 * these images).
 *
 * The white glyph is drawn over a slightly wider copy of itself in the ink
 * colour — a thin dark outline around every stroke — so the icon stays
 * legible on any stage colour, light ones included. Stage colours are
 * therefore not constrained by icon contrast (lib/barvePreverba.ts reports
 * it for information only).
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Map as MaplibreMap } from "maplibre-gl";
import { VRSTA_ICONS } from "@/lib/vrsta";
import { barvaZetona } from "@/lib/mapBarve";
import type { Vrsta } from "@/lib/types";

const ICON_SIZE = 96;
/** Lucide's own stroke, in its 24-unit viewBox. */
const STROKE = 2.25;
/** The dark copy underneath: ~1.1 units of outline on each side (≈ 0.7 px at the map's icon size). */
const OBROBA = STROKE + 2.25;

export function vrstaIconImageId(vrsta: Vrsta): string {
  return `vrsta-icon-${vrsta}`;
}

function svgDataUri(vrsta: Vrsta, color: string, strokeWidth: number): string {
  const Icon = VRSTA_ICONS[vrsta];
  const markup = renderToStaticMarkup(createElement(Icon, { color, strokeWidth, width: ICON_SIZE, height: ICON_SIZE }));
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
}

/** Ink outline first, then the white glyph on top (see header). */
function sloji(vrsta: Vrsta): string[] {
  return [svgDataUri(vrsta, barvaZetona("crnilo"), OBROBA), svgDataUri(vrsta, barvaZetona("povrsina"), STROKE)];
}

/**
 * Rasterizes one SVG icon via a plain <img> + <canvas> (NOT
 * map.loadImage(): that routes through MapLibre's fetch/createImageBitmap
 * resource pipeline, which does not reliably decode `image/svg+xml` data
 * URIs — it's built for raster tile/sprite images). The <img>-element path
 * is the same one browsers use to paint inline SVGs, so it always works.
 */
function naloziSliko(dataUri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("SVG image failed to load"));
    img.src = dataUri;
  });
}

/** Draws the SVG layers onto one canvas, in order. */
async function rasterizeSvg(dataUris: string[], size: number): Promise<ImageData> {
  const slike = await Promise.all(dataUris.map(naloziSliko));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  for (const img of slike) ctx.drawImage(img, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size);
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
        const imageData = await rasterizeSvg(sloji(vrsta), ICON_SIZE);
        if (!map.hasImage(id)) map.addImage(id, imageData);
      } catch (err) {
        console.warn(`[mapIcons] Ikona za vrsto "${vrsta}" se ni naložila:`, err);
      }
    }),
  );
}
