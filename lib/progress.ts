/**
 * The only place allowed to touch localStorage (CLAUDE.md convention).
 * Every access is wrapped in try/catch: private browsing, disabled storage,
 * or a full quota must never crash the page — they just mean the
 * preference silently doesn't persist.
 */

const KEYS = {
  vecjaPisava: "pot-ob-zici:vecja-pisava",
  obiskaneTocke: "pot-ob-zici:obiskane-tocke",
} as const;

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignored — preference just won't persist this session
  }
}

/** "Večja pisava" accessibility toggle (WCAG hard requirement). */
export function getVecjaPisava(): boolean {
  return safeGet(KEYS.vecjaPisava) === "1";
}

export function setVecjaPisava(enabled: boolean): void {
  safeSet(KEYS.vecjaPisava, enabled ? "1" : "0");
}

/**
 * Visited-point IDs. Written from day one so Phase 5 (badges at
 * 10/25/40/50, /moja-pot) has data to read — but nothing reads this yet.
 */
export function getObiskaneTocke(): string[] {
  const raw = safeGet(KEYS.obiskaneTocke);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function markTockaObiskana(id: string): void {
  const current = getObiskaneTocke();
  if (current.includes(id)) return;
  try {
    safeSet(KEYS.obiskaneTocke, JSON.stringify([...current, id]));
  } catch {
    // ignored
  }
}
