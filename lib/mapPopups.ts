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
import { getGoogleMapsUrl } from "@/lib/zemljevidi";
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

export function buildTockaPopupElement(tocka: Tocka): HTMLElement {
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

  const peljiLink = el("a", "block rounded border border-charcoal-600/40 px-2.5 py-1.5 text-center text-xs font-medium text-charcoal-800 hover:bg-charcoal-900/5", "Pelji me tja ↗");
  peljiLink.setAttribute("href", getGoogleMapsUrl(tocka.lat, tocka.lon));
  peljiLink.setAttribute("target", "_blank");
  peljiLink.setAttribute("rel", "noopener noreferrer");
  actions.appendChild(peljiLink);

  body.appendChild(actions);
  root.appendChild(body);
  return root;
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
