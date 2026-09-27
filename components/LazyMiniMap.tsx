"use client";

/**
 * next/dynamic with ssr:false can't be called directly inside a Server
 * Component — this tiny client wrapper is the boundary that makes it legal,
 * so detail pages (Server Components) can still lazy-load MiniMap and keep
 * maplibre-gl's ~270kB out of their initial JS (Lighthouse mobile target).
 */

import dynamic from "next/dynamic";

const MiniMap = dynamic(() => import("@/components/MiniMap"), {
  ssr: false,
  loading: () => (
    <div className="map-chrome flex h-full w-full items-center justify-center text-xs">Nalagam zemljevid …</div>
  ),
});

export default MiniMap;
