import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  ProjectStorageProvider,
  ProjectVisibility,
  ProjectLicense,
  StorageUser,
  StorageQuota,
  StoredProject,
  StoredProjectMeta,
} from './projectStorage';

/**
 * Provider chmurowy (Supabase): logowanie, projekty online z limitem miejsca,
 * udostępnianie + licencje. Schemat bazy: supabase/schema.sql,
 * instrukcja konfiguracji: SUPABASE_SETUP.md.
 *
 * Klient jest wstrzykiwany (testy używają mocka o tym samym kształcie).
 */

/** Domyślny limit miejsca — musi odpowiadać default w profiles.storage_limit_bytes. */
export const DEFAULT_CLOUD_LIMIT_BYTES = 10 * 1024 * 1024;

interface ProjectRow {
  id: string;
  owner_id: string;
  name: string;
  json: unknown;
  size_bytes: number;
  visibility: ProjectVisibility;
  license: ProjectLicense;
  created_at: string;
  updated_at: string;
}

const rowToMeta = (row: ProjectRow): StoredProjectMeta => ({
  id: row.id,
  name: row.name,
  ownerId: row.owner_id,
  visibility: row.visibility,
  license: row.license,
  sizeBytes: row.size_bytes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const byteSize = (s: string): number => new Blob([s]).size;

/**
 * Supabase od 2025 wydaje nowe klucze API: "publishable" (sb_publishable_...)
 * zastępuje starszy "anon" (JWT). Oba działają w createClient() identycznie —
 * preferujemy publishable (VITE_SUPABASE_PUB), ale stary VITE_SUPABASE_ANON_KEY
 * jest wspierany jako fallback dla projektów jeszcze na legacy kluczach.
 */
export function getSupabaseConfig(): { url: string; publishableKey: string } | null {
  const url = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
  // `||` (nie `??`): pusty string traktujemy jak "nie ustawiono", nie jak ważny klucz
  const publishableKey = (import.meta.env?.VITE_SUPABASE_PUB || import.meta.env?.VITE_SUPABASE_ANON_KEY) as string | undefined;
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export class SupabaseProjectStorageProvider implements ProjectStorageProvider {
  readonly kind = 'cloud' as const;
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    if (client) {
      this.client = client;
    } else {
      const config = getSupabaseConfig();
      if (!config) {
        throw new Error('Supabase nie jest skonfigurowane (VITE_SUPABASE_URL / VITE_SUPABASE_PUB)');
      }
      this.client = createClient(config.url, config.publishableKey);
    }
  }

  // --- Auth ---

  async getCurrentUser(): Promise<StorageUser | null> {
    const { data } = await this.client.auth.getUser();
    if (!data.user) return null;
    return {
      id: data.user.id,
      email: data.user.email ?? null,
      displayName: data.user.email?.split('@')[0] ?? 'Użytkownik',
    };
  }

  async signIn(email: string, password: string): Promise<StorageUser> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error || !data.user) throw new Error(error?.message ?? 'Logowanie nie powiodło się');
    return { id: data.user.id, email: data.user.email ?? null, displayName: email.split('@')[0] };
  }

  async signUp(email: string, password: string): Promise<StorageUser> {
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error || !data.user) throw new Error(error?.message ?? 'Rejestracja nie powiodła się');
    return { id: data.user.id, email: data.user.email ?? null, displayName: email.split('@')[0] };
  }

  async signOut(): Promise<void> {
    await this.client.auth.signOut();
  }

  private async requireUserId(): Promise<string> {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('Zaloguj się, żeby korzystać z projektów w chmurze');
    return user.id;
  }

  // --- Projekty ---

  async listProjects(): Promise<StoredProjectMeta[]> {
    const ownerId = await this.requireUserId();
    const { data, error } = await this.client
      .from('projects')
      .select('id, owner_id, name, size_bytes, visibility, license, created_at, updated_at')
      .eq('owner_id', ownerId)
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as unknown as ProjectRow[]).map(row => rowToMeta({ ...row, json: null }));
  }

  async loadProject(id: string): Promise<StoredProject | null> {
    const { data, error } = await this.client
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const row = data as unknown as ProjectRow;
    return {
      ...rowToMeta(row),
      json: typeof row.json === 'string' ? row.json : JSON.stringify(row.json),
    };
  }

  async saveProject(input: { id?: string; name: string; json: string }): Promise<StoredProjectMeta> {
    const ownerId = await this.requireUserId();
    const payload = {
      owner_id: ownerId,
      name: input.name,
      json: JSON.parse(input.json),
      size_bytes: byteSize(input.json),
    };

    // Limit miejsca egzekwuje trigger w bazie (enforce_storage_limit) —
    // tu tylko tłumaczymy błąd na czytelny komunikat.
    const translate = (message: string): Error =>
      /storage limit/i.test(message)
        ? new Error('Przekroczono limit miejsca w chmurze. Usuń stare projekty albo zmniejsz tekstury.')
        : new Error(message);

    if (input.id) {
      const { data, error } = await this.client
        .from('projects')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', input.id)
        .select()
        .single();
      if (error) throw translate(error.message);
      return rowToMeta(data as unknown as ProjectRow);
    }

    const { data, error } = await this.client
      .from('projects')
      .insert(payload)
      .select()
      .single();
    if (error) throw translate(error.message);
    return rowToMeta(data as unknown as ProjectRow);
  }

  async deleteProject(id: string): Promise<void> {
    const { error } = await this.client.from('projects').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  // --- Quota ---

  async getQuota(): Promise<StorageQuota> {
    const ownerId = await this.requireUserId();

    const { data: profile } = await this.client
      .from('profiles')
      .select('storage_limit_bytes')
      .eq('id', ownerId)
      .maybeSingle();

    const { data: projects, error } = await this.client
      .from('projects')
      .select('size_bytes')
      .eq('owner_id', ownerId);
    if (error) throw new Error(error.message);

    const usedBytes = (projects as { size_bytes: number }[] ?? [])
      .reduce((sum, p) => sum + p.size_bytes, 0);
    const limitBytes = (profile as { storage_limit_bytes?: number } | null)?.storage_limit_bytes
      ?? DEFAULT_CLOUD_LIMIT_BYTES;

    return { usedBytes, limitBytes };
  }

  // --- Udostępnianie / licencja ---

  async setSharing(id: string, visibility: ProjectVisibility, license: ProjectLicense): Promise<StoredProjectMeta> {
    const { data, error } = await this.client
      .from('projects')
      .update({ visibility, license, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return rowToMeta(data as unknown as ProjectRow);
  }
}
