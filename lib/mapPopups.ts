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
import { lineLengthMeters, formatDistance } from "@/lib/geo";

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
    "inline-block rounded-full border border-charcoal-600/30 bg-charcoal-900/5 px-2 py-0.5 text-[11px] font-medium text-charcoal-800",
    label,
  );
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
export function buildTockaPopupElement(tocka: Tocka, onPeljiMeTja: () => void): TockaPopupHandle {
  const root = el("div", "w-64 overflow-hidden rounded-lg bg-offwhite-50 text-charcoal-950 shadow-xl");

  const photo = el(
    "div",
    "flex h-20 items-center justify-center bg-charcoal-800 text-center text-xs font-heading font-semibold tracking-wide text-offwhite-100",
    `${tocka.id} · ${VRSTA_LABELS[tocka.vrsta]}`,
  );
  root.appendChild(photo);

  const body = el("div", "p-3");
  body.appendChild(el("p", "text-[11px] text-charcoal-600", tocka.obmocje));
  body.appendChild(el("h3", "font-heading text-sm leading-snug font-bold", tocka.naziv));

  const chips = el("div", "mt-1.5 flex flex-wrap gap-1");
  chips.appendChild(chip(VRSTA_LABELS[tocka.vrsta]));
  for (const z of tocka.zgodbe_predlog) chips.appendChild(chip(ZGODBA_LABELS[z]));
  body.appendChild(chips);

  body.appendChild(el("p", "mt-2 text-xs leading-snug text-charcoal-800", tocka.iztocnica));

  const actions = el("div", "mt-3 flex flex-col gap-1.5");
  const vecLink = el("a", "block rounded bg-accent-red px-2.5 py-1.5 text-center text-xs font-semibold text-offwhite-50 hover:bg-accent-red-dark", "Več o obeležju →");
  vecLink.setAttribute("href", `/tocka/${tocka.slug}`);
  actions.appendChild(vecLink);

  const peljiButton = el("button", "block w-full rounded border border-charcoal-600/40 px-2.5 py-1.5 text-center text-xs font-medium text-charcoal-800 hover:bg-charcoal-900/5", "Pelji me tja");
  peljiButton.type = "button";
  peljiButton.addEventListener("click", onPeljiMeTja);
  actions.appendChild(peljiButton);

  const fallbacks = el("div", "flex items-center justify-center gap-3 text-[11px]");
  const googleLink = el("a", "text-charcoal-600 underline hover:text-accent-red", "Google Zemljevidi ↗");
  googleLink.setAttribute("href", getGoogleMapsUrl(tocka.lat, tocka.lon));
  googleLink.setAttribute("target", "_blank");
  googleLink.setAttribute("rel", "noopener noreferrer");
  const appleLink = el("a", "text-charcoal-600 underline hover:text-accent-red", "Apple Zemljevidi ↗");
  appleLink.setAttribute("href", getAppleMapsUrl(tocka.lat, tocka.lon));
  appleLink.setAttribute("target", "_blank");
  appleLink.setAttribute("rel", "noopener noreferrer");
  fallbacks.appendChild(googleLink);
  fallbacks.appendChild(appleLink);
  actions.appendChild(fallbacks);

  body.appendChild(actions);
  root.appendChild(body);
  return { root, peljiButton };
}

export function buildPotPopupElement(pot: Pot, tockCount: number): HTMLElement {
  const root = el("div", "w-60 overflow-hidden rounded-lg bg-offwhite-50 p-3 text-charcoal-950 shadow-xl");

  const header = el("div", "flex items-center gap-2");
  const swatch = el("span", "inline-block h-3 w-3 shrink-0 rounded-full");
  swatch.style.backgroundColor = pot.barva;
  header.appendChild(swatch);
  header.appendChild(el("h3", "font-heading text-sm font-bold leading-snug", pot.naziv));
  root.appendChild(header);

  if (pot.odsek) root.appendChild(el("p", "mt-1 text-xs text-charcoal-600", pot.odsek));

  const meters = lineLengthMeters(pot.geometry.coordinates);
  root.appendChild(
    el("p", "mt-1 text-xs text-charcoal-800", `${tockCount} točk · pribl. ${formatDistance(meters)}`),
  );

  if (pot.status) {
    root.appendChild(
      el("p", "mt-1 text-[11px] font-medium text-accent-red-dark", "Trasa je shematska — prava pot še ni vrisana."),
    );
  }

  const link = el("a", "mt-2.5 block rounded bg-accent-red px-2.5 py-1.5 text-center text-xs font-semibold text-offwhite-50 hover:bg-accent-red-dark", "Odpri pot →");
  link.setAttribute("href", `/pot/${pot.slug}`);
  root.appendChild(link);

  return root;
}
