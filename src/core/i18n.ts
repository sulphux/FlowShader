import { useCallback, useSyncExternalStore } from 'react';

export type AppLanguage = 'en' | 'pl';

export const LANGUAGE_STORAGE_KEY = 'flowshader-language-v1';
const LANGUAGE_EVENT = 'flowshader-language-change';

export function getLanguage(): AppLanguage {
  if (typeof localStorage === 'undefined') return 'en';
  return localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'pl' ? 'pl' : 'en';
}

export function setLanguage(language: AppLanguage): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LANGUAGE_EVENT));
}

const subscribe = (notify: () => void) => {
  if (typeof window === 'undefined') return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === LANGUAGE_STORAGE_KEY) notify();
  };
  window.addEventListener(LANGUAGE_EVENT, notify);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(LANGUAGE_EVENT, notify);
    window.removeEventListener('storage', onStorage);
  };
};

/** English is always the primary/fallback copy; Polish is an optional override. */
export function useI18n() {
  const language = useSyncExternalStore(subscribe, getLanguage, () => 'en' as const);
  const text = useCallback((english: string, polish?: string) =>
    language === 'pl' && polish ? polish : english, [language]);

  return { language, setLanguage, text };
}
