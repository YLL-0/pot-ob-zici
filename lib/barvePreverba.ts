/**
 * Stage-colour checks (Phase 4.3 brief), shared by `npm run barve:preizkus`
 * and the admin colour picker (cms/components/BarvaEtapePolje.tsx):
 *
 * - legible under the off-white marker icon (WCAG 1.4.11 non-text, ≥ 3:1);
 * - distinguishable from the other stages under normal vision and the
 *   common colour-vision deficiencies. Each colour is simulated for
 *   protanopia, deuteranopia and tritanopia (Machado et al. 2009, full
 *   severity), then compared in CIELAB (ΔE*76). Stages that meet on the
 *   ring (n and n+1, last and first) share a joint and need more distance.
 *
 * Pure functions, no DOM — safe on the server, in scripts and in the browser.
 */

/** Below this ΔE two colours start to read as "the same" on a small map line. */
export const MEJA_VSI = 15;
export const MEJA_SOSEDNJI = 20;
/** WCAG 1.4.11 non-text contrast for the white icon on the marker. */
export const MEJA_KONTRAST = 3;
/** Marker icon colour (app/(frontend)/globals.css --color-povrsina). */
export const IKONA = "#faf8f4";

export const HEX = /^#[0-9a-f]{6}$/i;

type Rgb = [number, number, number];

export const VIDI = {
  normalno: "običajen vid",
  protanopija: "protanopija",
  devteranopija: "devteranopija",
  tritanopija: "tritanopija",
} as const;
export type Vid = keyof typeof VIDI;

const MATRIKE: Record<Vid, Rgb[]> = {
  normalno: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  protanopija: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  devteranopija: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopija: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};

const izHex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb;
const linearno = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function lab([r, g, b]: Rgb): Rgb {
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function simuliraj(hex: string, m: Rgb[]): Rgb {
  const l = izHex(hex).map(linearno);
  return m.map((v) => Math.min(1, Math.max(0, v[0] * l[0]! + v[1] * l[1]! + v[2] * l[2]!))) as Rgb;
}

const dE = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** ΔE*76 between two colours as seen with `vid`. */
export function razdaljaBarv(a: string, b: string, vid: Vid): number {
  const m = MATRIKE[vid];
  return dE(lab(simuliraj(a, m)), lab(simuliraj(b, m)));
}

export function kontrast(a: string, b: string): number {
  const svetlost = (h: string) => {
    const [r, g, bl] = izHex(h).map(linearno) as Rgb;
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [svetlost(a), svetlost(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export interface PrimerjanaEtapa {
  ime: string;
  barva: string;
  /** Meets this stage on the ring (the stage before or after). */
  sosednja: boolean;
}

export interface Konflikt {
  ime: string;
  vid: Vid;
  razdalja: number;
  sosednja: boolean;
}

export interface PreverbaBarve {
  kontrastZIkono: number;
  kontrastOk: boolean;
  /** Pairs below the threshold, closest first; one entry per stage (its worst vision type). */
  konflikti: Konflikt[];
}

/** Checks one candidate colour against the others. */
export function preveriBarvo(barva: string, ostale: PrimerjanaEtapa[]): PreverbaBarve {
  const kontrastZIkono = kontrast(barva, IKONA);
  const konflikti: Konflikt[] = [];
  for (const o of ostale) {
    if (!HEX.test(o.barva)) continue;
    const meja = o.sosednja ? MEJA_SOSEDNJI : MEJA_VSI;
    let najslabsi: Konflikt | null = null;
    for (const vid of Object.keys(MATRIKE) as Vid[]) {
      const razdalja = razdaljaBarv(barva, o.barva, vid);
      if (razdalja < meja && (!najslabsi || razdalja < najslabsi.razdalja)) {
        najslabsi = { ime: o.ime, vid, razdalja, sosednja: o.sosednja };
      }
    }
    if (najslabsi) konflikti.push(najslabsi);
  }
  konflikti.sort((a, b) => a.razdalja - b.razdalja);
  return { kontrastZIkono, kontrastOk: kontrastZIkono >= MEJA_KONTRAST, konflikti };
}
