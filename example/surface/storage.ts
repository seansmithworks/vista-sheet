// localStorage for the surface tuner. Every access is guarded: private
// windows, quota errors and blocked storage must never break the page.
import { defaultState, type TunerState } from "./model";
import type { Version } from "./history";

export const STORE_KEY = "vista-sheet:surface-tuner:v1";
export const THEME_KEY = "vista-sheet:surface-tuner:theme";
export const VERSIONS_KEY = "vista-sheet:surface-tuner:versions:v1";

export function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable or full: keep running in memory */
  }
}

function safeJson<T>(key: string): T | null {
  const raw = safeGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadState(): TunerState {
  const saved = safeJson<TunerState>(STORE_KEY);
  return saved ? { ...defaultState(), ...saved } : defaultState();
}

export function loadVersions(): Version[] {
  const saved = safeJson<Version[]>(VERSIONS_KEY);
  return Array.isArray(saved) ? saved : [];
}
