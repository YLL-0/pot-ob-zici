"use client";

/**
 * Builds popup DOM content for the map (marker click / trail click).
 * Plain DOM, not React: these mount into a maplibregl.Popup via
 * setDOMContent(), which lives outside the app's React tree/router
 * context — a <Link> there would have no router to talk to, so actions
 * are plain <a> tags (a full navigation into the detail page is a
 * reasonable context switch anyway).
 */

import type { Pot, Tocka } from "@/lib/types";
import { VRSTA_LABELS } from "@/lib/vrsta";
import { ZGODBA_LABELS } from "@/lib/zgodbe";
import { getAppleMapsUrl, getGoogleMapsUrl } from "@/lib/zemljevidi";
import { formatDistance } from "@/lib/geo";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function chip(label: string): HTMLElement {
  return el(
    "span",
    "inline-block rounded-full border border-crta bg-papir px-2 py-0.5 text-xs font-medium text-crnilo",
    label,
  );
}

/** The point's stage, for the popup's key of the two lines on the map. */
export interface PopupLegenda {
  naziv: string;
  barva: string;
  /** The stage line is (partly) the schematic fallback — drawn dashed. */
  shematsko: boolean;
}

/** A short line sample, drawn with a top border so it matches the map's line style. */
function vzorecCrte(slog: "solid" | "dashed" | "dotted", barvaRazred: string | null, barva?: string): HTMLElement {
  const sample = el("span", `inline-block w-6 shrink-0 border-t-4 ${barvaRazred ?? ""}`);
  sample.style.borderTopStyle = slog;
  if (barva) sample.style.borderTopColor = barva;
  sample.setAttribute("aria-hidden", "true");
  return sample;
}

/**
 * Two routes can be on screen at once — the stage trail and the personal
 * walking route — so the popup says which line is which.
 */
function legendaCrt(legenda: PopupLegenda): HTMLElement {
  const box = el("div", "mt-2 space-y-1 rounded bg-tonirano p-1.5 text-xs leading-snug text-crnilo");
  const etapa = el("p", "flex items-center gap-1.5");
  etapa.appendChild(vzorecCrte(legenda.shematsko ? "dashed" : "solid", null, legenda.barva));
  etapa.appendChild(el("span", undefined, `Trasa: ${legenda.naziv} (${legenda.shematsko ? "shematska povezava" : "izračunana, ni uradno označena pot"})`));
  box.appendChild(etapa);
  const pot = el("p", "flex items-center gap-1.5");
  pot.appendChild(vzorecCrte("dotted", "border-crnilo"));
  pot.appendChild(el("span", undefined, "Pelji me tja: vaša pot do obeležja"));
  box.appendChild(pot);
  return box;
}

export interface TockaPopupHandle {
  root: HTMLElement;
  /** The in-app "Pelji me tja" button — MapView updates its label/disabled state during the async route request. */
  peljiButton: HTMLButtonElement;
}

/**
 * `onPeljiMeTja` drives the in-app ORS route (drawn on the real map by the
 * caller); the Google/Apple links right below it are the always-available
 * fallback, unconditionally present per the "must stay reachable even when
 * the in-app route works, and work when geolocation is denied" rule.
 */
export function buildTockaPopupElement(
  tocka: Tocka,
  legenda: PopupLegenda | null,
  onPeljiMeTja: () => void,
): TockaPopupHandle {
  const root = el("div", "w-64 overflow-hidden rounded-xl bg-povrsina text-crnilo");

  const photo = el(
    "div",
    "flex h-20 items-center justify-center bg-tonirano text-center text-xs font-heading font-semibold tracking-wide text-crnilo-mehko",
    `${tocka.id} · ${VRSTA_LABELS[tocka.vrsta]}`,
  );
  root.appendChild(photo);

  const body = el("div", "p-3");
  body.appendChild(el("p", "text-xs text-crnilo-mehko", tocka.obmocje));
  body.appendChild(el("h3", "font-heading text-base leading-snug font-semibold", tocka.naziv));

  const chips = el("div", "mt-1.5 flex flex-wrap gap-1");
  chips.appendChild(chip(VRSTA_LABELS[tocka.vrsta]));
  for (const z of tocka.zgodbe_predlog) chips.appendChild(chip(ZGODBA_LABELS[z]));
  body.appendChild(chips);

  body.appendChild(el("p", "mt-2 text-xs leading-snug text-crnilo", tocka.iztocnica));

  const actions = el("div", "mt-3 flex flex-col gap-1.5");
  const vecLink = el("a", "block rounded bg-poudarek px-2.5 py-1.5 text-center text-xs font-semibold text-white hover:bg-poudarek-temno", "Več o obeležju →");
  vecLink.setAttribute("href", `/tocka/${tocka.slug}`);
  actions.appendChild(vecLink);

  const peljiButton = el("button", "block w-full rounded border border-crta-mocna px-2.5 py-1.5 text-center text-xs font-medium text-crnilo hover:bg-tonirano", "Pelji me tja");
  peljiButton.type = "button";
  peljiButton.addEventListener("click", onPeljiMeTja);
  actions.appendChild(peljiButton);

  const fallbacks = el("div", "flex items-center justify-center gap-3 text-xs");
  const googleLink = el("a", "text-crnilo-mehko underline hover:text-poudarek", "Google Zemljevidi ↗");
  googleLink.setAttribute("href", getGoogleMapsUrl(tocka.lat, tocka.lon));
  googleLink.setAttribute("target", "_blank");
  googleLink.setAttribute("rel", "noopener noreferrer");
  const appleLink = el("a", "text-crnilo-mehko underline hover:text-poudarek", "Apple Zemljevidi ↗");
  appleLink.setAttribute("href", getAppleMapsUrl(tocka.lat, tocka.lon));
  appleLink.setAttribute("target", "_blank");
  appleLink.setAttribute("rel", "noopener noreferrer");
  fallbacks.appendChild(googleLink);
  fallbacks.appendChild(appleLink);
  actions.appendChild(fallbacks);

  if (legenda) actions.appendChild(legendaCrt(legenda));

  body.appendChild(actions);
  root.appendChild(body);
  return { root, peljiButton };
}

/**
 * `meters` and `sporocilo` describe what is actually drawn (the routed or
 * schematic ring section), so the label is always honest about it.
 */
export function buildPotPopupElement(pot: Pot, tockCount: number, meters: number, sporocilo: string | null): HTMLElement {
  const root = el("div", "w-60 overflow-hidden rounded-xl bg-povrsina p-3 text-crnilo");

  const header = el("div", "flex items-center gap-2");
  const swatch = el("span", "inline-block h-3 w-3 shrink-0 rounded-full");
  swatch.style.backgroundColor = pot.barva;
  header.appendChild(swatch);
  header.appendChild(el("h3", "font-heading text-base font-semibold leading-snug", pot.naziv));
  root.appendChild(header);

  if (pot.odsek) root.appendChild(el("p", "mt-1 text-xs text-crnilo-mehko", pot.odsek));

  root.appendChild(
    el("p", "mt-1 text-xs text-crnilo", `${tockCount} točk · pribl. ${formatDistance(meters)}`),
  );

  if (sporocilo) {
    root.appendChild(el("p", "mt-1 text-xs font-medium text-poudarek-temno", sporocilo));
  }

  const link = el("a", "mt-2.5 block rounded bg-poudarek px-2.5 py-1.5 text-center text-xs font-semibold text-white hover:bg-poudarek-temno", "Odpri pot →");
  link.setAttribute("href", `/pot/${pot.slug}`);
  root.appendChild(link);

  return root;
}
