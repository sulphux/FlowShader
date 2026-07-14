import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLanguage, LANGUAGE_STORAGE_KEY, setLanguage } from './i18n';

describe('application language', () => {
  beforeEach(() => localStorage.clear());

  it('uses English by default and for invalid stored values', () => {
    expect(getLanguage()).toBe('en');
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de');
    expect(getLanguage()).toBe('en');
  });

  it('persists Polish and notifies mounted UI', () => {
    const listener = vi.fn();
    window.addEventListener('flowshader-language-change', listener);
    setLanguage('pl');
    expect(getLanguage()).toBe('pl');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pl');
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('flowshader-language-change', listener);
  });
});
