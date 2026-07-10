import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalProjectStorageProvider, createProjectStorage } from '../core/projectStorage';

/**
 * Warstwa przechowywania projektów — fundament pod logowanie/chmurę/licencje.
 * Provider lokalny musi egzekwować ten sam kontrakt, który później
 * zrealizuje provider chmurowy (CRUD, quota, udostępnianie+licencja).
 */

describe('LocalProjectStorageProvider', () => {
  let storage: LocalProjectStorageProvider;

  beforeEach(() => {
    localStorage.clear();
    storage = new LocalProjectStorageProvider();
  });

  describe('createProjectStorage factory', () => {
    // .env.local (dev) może mieć prawdziwe klucze Supabase — jawnie je czyścimy,
    // żeby przetestować zachowanie bez konfiguracji chmury niezależnie od środowiska.
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('returns the local provider when cloud env is not configured', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', '');
      vi.stubEnv('VITE_SUPABASE_PUB', '');
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

      expect((await createProjectStorage()).kind).toBe('local');
    });

    it('returns the cloud provider when VITE_SUPABASE_URL and VITE_SUPABASE_PUB are set', async () => {
      vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
      vi.stubEnv('VITE_SUPABASE_PUB', 'sb_publishable_test');

      expect((await createProjectStorage()).kind).toBe('cloud');
    });
  });

  it('always has a local user (no login required)', async () => {
    const user = await storage.getCurrentUser();
    expect(user.id).toBe('local');
  });

  it('saves, lists and loads projects', async () => {
    const meta = await storage.saveProject({ name: 'Neon', json: '{"nodes":[]}' });
    expect(meta.visibility).toBe('private');
    expect(meta.license).toBe('all-rights-reserved');

    const list = await storage.listProjects();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Neon');

    const loaded = await storage.loadProject(meta.id);
    expect(loaded?.json).toBe('{"nodes":[]}');
  });

  it('updates an existing project by id (no duplicates)', async () => {
    const meta = await storage.saveProject({ name: 'V1', json: '{"v":1}' });
    await storage.saveProject({ id: meta.id, name: 'V2', json: '{"v":2}' });

    const list = await storage.listProjects();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('V2');
    expect((await storage.loadProject(meta.id))?.json).toBe('{"v":2}');
  });

  it('deletes projects', async () => {
    const meta = await storage.saveProject({ name: 'Temp', json: '{}' });
    await storage.deleteProject(meta.id);
    expect(await storage.listProjects()).toHaveLength(0);
    expect(await storage.loadProject(meta.id)).toBeNull();
  });

  it('tracks quota usage and enforces the storage limit', async () => {
    await storage.saveProject({ name: 'Small', json: 'x'.repeat(1000) });
    const quota = await storage.getQuota();
    expect(quota.usedBytes).toBe(1000);
    expect(quota.limitBytes).toBeGreaterThan(0);

    // Przekroczenie limitu musi być odrzucone (kontrakt jak w chmurze)
    const tooBig = 'x'.repeat(quota.limitBytes + 1);
    await expect(storage.saveProject({ name: 'Huge', json: tooBig }))
      .rejects.toThrow(/limit/i);
    // Nieudany zapis nie śmieci indeksu
    expect(await storage.listProjects()).toHaveLength(1);
  });

  it('updating a project counts its NEW size against the quota (not double)', async () => {
    const quota = await storage.getQuota();
    const half = Math.floor(quota.limitBytes / 2);
    const meta = await storage.saveProject({ name: 'Big', json: 'x'.repeat(half) });
    // Nadpisanie tym samym rozmiarem nie może wywalić limitu (stary rozmiar nie liczy się podwójnie)
    await expect(storage.saveProject({ id: meta.id, name: 'Big', json: 'y'.repeat(half) }))
      .resolves.toBeTruthy();
  });

  it('sharing: visibility + license (system licencyjny)', async () => {
    const meta = await storage.saveProject({ name: 'Art', json: '{}' });

    const shared = await storage.setSharing(meta.id, 'public', 'cc-by');
    expect(shared.visibility).toBe('public');
    expect(shared.license).toBe('cc-by');

    const unshared = await storage.setSharing(meta.id, 'private', 'all-rights-reserved');
    expect(unshared.visibility).toBe('private');

    await expect(storage.setSharing('nope', 'public', 'cc0')).rejects.toThrow();
  });
});
