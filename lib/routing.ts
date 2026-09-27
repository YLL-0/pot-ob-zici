"use client";

/**
 * Shared client-side logic for "Pelji me tja" — used both by the plain-DOM
 * map popups (lib/mapPopups.ts / MapView.tsx) and the React PeljiMeTja
 * component on detail pages, so the geolocation + fetch + error handling
 * exists exactly once.
 */

import type { Tocka } from "@/lib/types";

export type RoutingErrorCode = "GEO_UNSUPPORTED" | "GEO_DENIED" | "GEO_UNAVAILABLE" | "FETCH_FAILED" | "NO_KEY";

export class RoutingError extends Error {
  code: RoutingErrorCode;
  constructor(code: RoutingErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "RoutingError";
  }
}

/** Short Slovenian messages, shared by the map popup and the detail-page PeljiMeTja component. */
export const ROUTING_ERROR_MESSAGES: Record<RoutingErrorCode, string> = {
  GEO_UNSUPPORTED: "Brskalnik ne podpira lokacije.",
  GEO_DENIED: "Dovoljenje za lokacijo je zavrnjeno.",
  GEO_UNAVAILABLE: "Lokacije ni mogoče določiti.",
  FETCH_FAILED: "Poti trenutno ni mogoče izračunati.",
  NO_KEY: "Navigacija v aplikaciji trenutno ni na voljo.",
};

export function messageForError(err: unknown): string {
  if (err instanceof RoutingError) return ROUTING_ERROR_MESSAGES[err.code];
  return "Prišlo je do nepričakovane napake.";
}

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
}

export interface WalkingRoute {
  geometry: GeoJSON.LineString;
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
}

export function getUserPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new RoutingError("GEO_UNSUPPORTED", "Brskalnik ne podpira geolokacije."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      resolve,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          reject(new RoutingError("GEO_DENIED", "Dovoljenje za lokacijo je zavrnjeno."));
        } else {
          reject(new RoutingError("GEO_UNAVAILABLE", "Lokacije trenutno ni mogoče določiti."));
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

/** Calls our server-side ORS proxy (app/api/route/route.ts) — the API key never reaches the browser. */
export async function fetchWalkingRoute(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): Promise<WalkingRoute> {
  const params = new URLSearchParams({
    fromLat: from.lat.toString(),
    fromLon: from.lon.toString(),
    toLat: to.lat.toString(),
    toLon: to.lon.toString(),
  });
  const res = await fetch(`/api/route?${params.toString()}`);
  if (res.status === 503) {
    throw new RoutingError("NO_KEY", "Navigacija v aplikaciji trenutno ni na voljo.");
  }
  if (!res.ok) {
    throw new RoutingError("FETCH_FAILED", "Poti trenutno ni mogoče izračunati.");
  }
  return (await res.json()) as WalkingRoute;
}

/** Full flow: ask for the user's position, then fetch the route to `to`. */
export async function planWalkingRoute(to: { lat: number; lon: number }): Promise<WalkingRoute> {
  const position = await getUserPosition();
  return fetchWalkingRoute({ lat: position.coords.latitude, lon: position.coords.longitude }, to);
}

/**
 * Shared "Pelji me tja" state shape — used by both MapExperience (the map
 * popup's in-app route) and PeljiMeTja (detail pages), so the panel/inline
 * UI can render the same states consistently.
 */
export type RouteState =
  | { status: "idle" }
  | { status: "loading"; tocka: Tocka }
  | { status: "ready"; tocka: Tocka; route: WalkingRoute }
  | { status: "error"; tocka: Tocka; error: string };
