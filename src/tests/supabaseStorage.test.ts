import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseProjectStorageProvider, DEFAULT_CLOUD_LIMIT_BYTES, getSupabaseConfig } from '../core/supabaseStorage';

/**
 * Provider chmurowy testowany na mocku klienta Supabase — kontrakt
 * ProjectStorageProvider musi być identyczny jak w providerze lokalnym.
 */

type QueryResult = { data: unknown; error: { message: string } | null };

/** Thenable query-builder: wszystkie metody chainują, await zwraca result. */
const mockQuery = (result: QueryResult) => {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  ['select', 'eq', 'order', 'insert', 'update', 'delete'].forEach(m => { builder[m] = vi.fn(chain); });
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve: (r: QueryResult) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
};

const makeClient = (options: {
  user?: { id: string; email: string } | null;
  tables?: Record<string, QueryResult[]>;
}) => {
  const queues = new Map(Object.entries(options.tables ?? {}));
  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: options.user ?? null } })),
      signInWithPassword: vi.fn(async () => ({ data: { user: options.user }, error: null })),
      signUp: vi.fn(async () => ({ data: { user: options.user }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn((table: string) => {
      const queue = queues.get(table) ?? [];
      const result = queue.length > 1 ? queue.shift()! : queue[0] ?? { data: null, error: null };
      return mockQuery(result);
    }),
  };
  return client as unknown as SupabaseClient;
};

const USER = { id: 'user-1', email: 'anna@example.com' };

const PROJECT_ROW = {
  id: 'p-1', owner_id: 'user-1', name: 'Neon', json: { nodes: [] }, size_bytes: 123,
  visibility: 'private', license: 'all-rights-reserved',
  created_at: '2026-07-09T10:00:00Z', updated_at: '2026-07-09T11:00:00Z',
};

describe('SupabaseProjectStorageProvider', () => {
  it('maps the authenticated user', async () => {
    const provider = new SupabaseProjectStorageProvider(makeClient({ user: USER }));
    const user = await provider.getCurrentUser();
    expect(user).toEqual({ id: 'user-1', email: 'anna@example.com', displayName: 'anna' });
  });

  it('returns null user when logged out and rejects project calls', async () => {
    const provider = new SupabaseProjectStorageProvider(makeClient({ user: null }));
    expect(await provider.getCurrentUser()).toBeNull();
    await expect(provider.listProjects()).rejects.toThrow(/zaloguj/i);
  });

  it('lists projects mapped to StoredProjectMeta', async () => {
    const provider = new SupabaseProjectStorageProvider(makeClient({
      user: USER,
      tables: { projects: [{ data: [PROJECT_ROW], error: null }] },
    }));
    const list = await provider.listProjects();
    expect(list).toEqual([{
      id: 'p-1', name: 'Neon', ownerId: 'user-1',
      visibility: 'private', license: 'all-rights-reserved',
      sizeBytes: 123, createdAt: '2026-07-09T10:00:00Z', updatedAt: '2026-07-09T11:00:00Z',
    }]);
  });

  it('loads a full project with its JSON', async () => {
    const provider = new SupabaseProjectStorageProvider(makeClient({
      user: USER,
      tables: { projects: [{ data: PROJECT_ROW, error: null }] },
    }));
    const project = await provider.loadProject('p-1');
    expect(project?.json).toBe('{"nodes":[]}');
  });

  it('translates the storage-limit trigger error into a friendly message', async () => {
    const provider = new SupabaseProjectStorageProvider(makeClient({
      user: USER,
      tables: { projects: [{ data: null, error: { message: 'new row violates: storage limit exceeded' } }] },
    }));
    await expect(provider.saveProject({ name: 'Big', json: '{}' }))
      .rejects.toThrow(/limit miejsca/i);
  });

  it('computes quota from project sizes and profile limit', async () => {
    const provider = new SupabaseProjectStorageProvider(makeClient({
      user: USER,
      tables: {
        profiles: [{ data: { storage_limit_bytes: 5000 }, error: null }],
        projects: [{ data: [{ size_bytes: 1000 }, { size_bytes: 500 }], error: null }],
      },
    }));
    expect(await provider.getQuota()).toEqual({ usedBytes: 1500, limitBytes: 5000 });
  });

  it('falls back to the default limit when the profile row is missing', async () => {
    const provider = new SupabaseProjectStorageProvider(makeClient({
      user: USER,
      tables: {
        profiles: [{ data: null, error: null }],
        projects: [{ data: [], error: null }],
      },
    }));
    expect((await provider.getQuota()).limitBytes).toBe(DEFAULT_CLOUD_LIMIT_BYTES);
  });

  it('setSharing updates visibility and license', async () => {
    const provider = new SupabaseProjectStorageProvider(makeClient({
      user: USER,
      tables: { projects: [{ data: { ...PROJECT_ROW, visibility: 'public', license: 'cc-by' }, error: null }] },
    }));
    const meta = await provider.setSharing('p-1', 'public', 'cc-by');
    expect(meta.visibility).toBe('public');
    expect(meta.license).toBe('cc-by');
  });
});

describe('getSupabaseConfig', () => {
  // .env.local (dev) może już mieć prawdziwe klucze Supabase — vi.unstubAllEnvs()
  // przywraca TE wartości, a nie undefined. Testy muszą więc jawnie nadpisać
  // wszystkie trzy zmienne (pustym stringiem = "brak"), zamiast polegać na resecie.
  const clearAll = () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUB', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  };

  beforeEach(() => {
    clearAll();
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('prefers the new publishable key (VITE_SUPABASE_PUB) over legacy anon', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUB', 'sb_publishable_new');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'legacy_anon_jwt');

    expect(getSupabaseConfig()).toEqual({
      url: 'https://x.supabase.co',
      publishableKey: 'sb_publishable_new',
    });
  });

  it('falls back to legacy VITE_SUPABASE_ANON_KEY when PUB is not set', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'legacy_anon_jwt');

    expect(getSupabaseConfig()).toEqual({
      url: 'https://x.supabase.co',
      publishableKey: 'legacy_anon_jwt',
    });
  });

  it('returns null when neither key is configured', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co');
    expect(getSupabaseConfig()).toBeNull();
  });

  it('returns null when URL is missing even if a key is set', () => {
    vi.stubEnv('VITE_SUPABASE_PUB', 'sb_publishable_new');
    expect(getSupabaseConfig()).toBeNull();
  });
});
