import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getGlobalSettings,
  updateGlobalSettings,
  subscribeGlobalSettings,
  DEFAULT_SETTINGS,
} from '../core/globalSettings';

describe('Global settings (FPS limit, quality)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults when nothing is stored', () => {
    expect(getGlobalSettings()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.fpsLimit).toBe(0);
    expect(DEFAULT_SETTINGS.resolutionScale).toBe(1);
  });

  it('persists updates across reads', () => {
    updateGlobalSettings({ fpsLimit: 30 });
    expect(getGlobalSettings().fpsLimit).toBe(30);
    // Druga zmiana nie kasuje pierwszej
    updateGlobalSettings({ resolutionScale: 0.5 });
    expect(getGlobalSettings()).toEqual({ fpsLimit: 30, resolutionScale: 0.5 });
  });

  it('sanitizes invalid stored values back to defaults', () => {
    localStorage.setItem('shader-nodes-settings-v1', JSON.stringify({ fpsLimit: 999, resolutionScale: 'huge' }));
    expect(getGlobalSettings()).toEqual(DEFAULT_SETTINGS);

    localStorage.setItem('shader-nodes-settings-v1', 'not json at all');
    expect(getGlobalSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('notifies subscribers on change and unsubscribes cleanly', () => {
    const callback = vi.fn();
    const unsubscribe = subscribeGlobalSettings(callback);

    updateGlobalSettings({ fpsLimit: 60 });
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ fpsLimit: 60 }));

    unsubscribe();
    updateGlobalSettings({ fpsLimit: 30 });
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
