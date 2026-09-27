"use client";

import { useEffect } from "react";
import { trackPointView } from "@/lib/analytics";

/** Fires the point_view analytics event once, client-side (see lib/analytics.ts). */
export default function TrackPointView({ slug }: { slug: string }) {
  useEffect(() => {
    trackPointView(slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per mount, not on every render
  }, []);
  return null;
}
