/**
 * Checks the live stage colours (`getEtape()`: Supabase or the seed) for
 * the Phase 4.3 brief: distinguishable from each other under normal vision
 * and the common colour-vision deficiencies, and legible under the
 * off-white marker icons.
 *
 *   npm run barve:preizkus                 # the stage colours as configured
 *   npm run barve:preizkus -- #aabbcc …    # a candidate palette, in stage order
 *
 * Method: each colour is simulated for protanopia, deuteranopia and
 * tritanopia (Machado et al. 2009, full severity), then compared in CIELAB
 * (ΔE*76). Stages that meet on the ring (n and n+1, last and first) are
 * reported separately — they share a joint and matter most.
 *
 * Reports only; exits 1 if a threshold is missed.
 */

import { getEtape } from "../lib/data";
import { sortEtape } from "../lib/etape";

/** Below this ΔE two colours start to read as "the same" on a small map line. */
const MEJA_VSI = 15;
const MEJA_SOSEDNJI = 20;
/** WCAG 1.4.11 non-text contrast for the white icon on the marker. */
const MEJA_KONTRAST = 3;
const IKONA = "#faf8f4";

type Rgb = [number, number, number];

const MATRIKE: Record<string, Rgb[]> = {
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

function kontrast(a: string, b: string): number {
  const svetlost = (h: string) => {
    const [r, g, bl] = izHex(h).map(linearno) as Rgb;
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [svetlost(a), svetlost(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

async function main() {
  const podane = process.argv.slice(2).filter((a) => /^#[0-9a-f]{6}$/i.test(a));
  const etape = sortEtape(await getEtape());
  const vrstice = podane.length > 0 ? podane.map((barva, i) => ({ ime: `#${i + 1}`, barva })) : etape.map((e) => ({ ime: e.naziv, barva: e.barva }));
  const n = vrstice.length;
  let napake = 0;

  console.log("Barve:");
  for (const v of vrstice) {
    const k = kontrast(v.barva, IKONA);
    const ok = k >= MEJA_KONTRAST;
    if (!ok) napake++;
    console.log(`  ${ok ? "✓" : "✗"} ${v.ime.padEnd(10)} ${v.barva}  kontrast z ikono ${k.toFixed(1)}:1`);
  }

  for (const [vid, m] of Object.entries(MATRIKE)) {
    const L = vrstice.map((v) => lab(simuliraj(v.barva, m)));
    const pari: { a: number; b: number; d: number; sosednji: boolean }[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        pari.push({ a: i, b: j, d: dE(L[i]!, L[j]!), sosednji: j === i + 1 || (i === 0 && j === n - 1 && n > 2) });
      }
    }
    pari.sort((x, y) => x.d - y.d);
    const slabi = pari.filter((p) => p.d < (p.sosednji ? MEJA_SOSEDNJI : MEJA_VSI));
    napake += slabi.length;
    const najblizji = pari[0];
    console.log(
      `\n${slabi.length === 0 ? "✓" : "✗"} ${vid}: najbližji par ${najblizji ? `${vrstice[najblizji.a]!.ime} ↔ ${vrstice[najblizji.b]!.ime} (ΔE ${najblizji.d.toFixed(1)})` : "—"}`,
    );
    for (const p of slabi) {
      console.log(`    ${vrstice[p.a]!.ime} ↔ ${vrstice[p.b]!.ime}: ΔE ${p.d.toFixed(1)}${p.sosednji ? " (sosednji na obroču)" : ""}`);
    }
  }

  console.log(
    napake === 0
      ? "\nVse meje izpolnjene."
      : `\n${napake} kršitev (meje: ΔE ≥ ${MEJA_VSI}, sosednji ≥ ${MEJA_SOSEDNJI}, kontrast ≥ ${MEJA_KONTRAST}:1).`,
  );
  process.exit(napake === 0 ? 0 : 1);
}

void main();
