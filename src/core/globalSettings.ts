/**
 * Globalne ustawienia renderowania (persystowane w localStorage).
 * - fpsLimit: 0 = bez limitu (pełny requestAnimationFrame), 30/60 = ograniczenie
 * - resolutionScale: mnożnik rozdzielczości renderowania (1 = natywna)
 * Zmiany są rozgłaszane zdarzeniem, na które subskrybują okna renderujące.
 */

export interface GlobalSettings {
  fpsLimit: 0 | 30 | 60;
  resolutionScale: 0.5 | 0.75 | 1;
}

const STORAGE_KEY = 'shader-nodes-settings-v1';
const EVENT_NAME = 'globalSettingsChanged';

export const DEFAULT_SETTINGS: GlobalSettings = {
  fpsLimit: 0,
  resolutionScale: 1,
};

const VALID_FPS = [0, 30, 60];
const VALID_SCALE = [0.5, 0.75, 1];

const sanitize = (raw: unknown): GlobalSettings => {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Partial<GlobalSettings>;
  return {
    fpsLimit: VALID_FPS.includes(obj.fpsLimit as number) ? (obj.fpsLimit as GlobalSettings['fpsLimit']) : DEFAULT_SETTINGS.fpsLimit,
    resolutionScale: VALID_SCALE.includes(obj.resolutionScale as number) ? (obj.resolutionScale as GlobalSettings['resolutionScale']) : DEFAULT_SETTINGS.resolutionScale,
  };
};

export function getGlobalSettings(): GlobalSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return sanitize(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function updateGlobalSettings(patch: Partial<GlobalSettings>): GlobalSettings {
  const next = sanitize({ ...getGlobalSettings(), ...patch });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent<GlobalSettings>(EVENT_NAME, { detail: next }));
  return next;
}

/** Subskrypcja zmian; zwraca funkcję odpinającą. */
export function subscribeGlobalSettings(callback: (settings: GlobalSettings) => void): () => void {
  const handler = (e: Event) => callback((e as CustomEvent<GlobalSettings>).detail);
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
