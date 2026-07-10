/**
 * Warstwa przechowywania projektów — abstrakcja pod przyszły backend
 * (logowanie, zapis online, limity miejsca, udostępnianie i licencje).
 *
 * UI programuje się wyłącznie do interfejsu ProjectStorageProvider.
 * Dziś działa LocalProjectStorageProvider (localStorage, bez logowania);
 * provider chmurowy (np. Supabase) podmienia się w jednym miejscu
 * (createProjectStorage) bez zmian w komponentach.
 *
 * Architektura backendu: patrz CLOUD_SYNC_DESIGN.md w katalogu głównym repo.
 */

export type ProjectVisibility = 'private' | 'unlisted' | 'public';

/** Licencja, na jakiej autor udostępnia projekt (gdy nie-private). */
export type ProjectLicense =
  | 'all-rights-reserved' // domyślna: patrz, ale nie kopiuj
  | 'cc-by'               // używaj z podaniem autora
  | 'cc-by-nc'            // niekomercyjnie, z podaniem autora
  | 'cc0';                // domena publiczna

export interface StorageUser {
  id: string;
  email: string | null;
  displayName: string;
}

export interface StorageQuota {
  usedBytes: number;
  limitBytes: number;
}

export interface StoredProjectMeta {
  id: string;
  name: string;
  ownerId: string;
  visibility: ProjectVisibility;
  license: ProjectLicense;
  sizeBytes: number;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface StoredProject extends StoredProjectMeta {
  /** Zserializowany graf (format serializeGraph). */
  json: string;
}

export interface ProjectStorageProvider {
  /** Identyfikator providera — do diagnostyki/UI. */
  readonly kind: 'local' | 'cloud';

  // --- Auth (provider lokalny: zawsze zalogowany "lokalny" użytkownik) ---
  getCurrentUser(): Promise<StorageUser | null>;
  signIn?(email: string, password: string): Promise<StorageUser>;
  signUp?(email: string, password: string): Promise<StorageUser>;
  signOut?(): Promise<void>;

  // --- Projekty ---
  listProjects(): Promise<StoredProjectMeta[]>;
  loadProject(id: string): Promise<StoredProject | null>;
  saveProject(input: { id?: string; name: string; json: string }): Promise<StoredProjectMeta>;
  deleteProject(id: string): Promise<void>;

  // --- Limity miejsca ---
  getQuota(): Promise<StorageQuota>;

  // --- Udostępnianie / licencja ---
  setSharing(id: string, visibility: ProjectVisibility, license: ProjectLicense): Promise<StoredProjectMeta>;
}

// ============================================================================
// PROVIDER LOKALNY (localStorage) — działa dziś, bez logowania
// ============================================================================

const LOCAL_INDEX_KEY = 'shader-nodes-projects-v1';
const LOCAL_USER: StorageUser = { id: 'local', email: null, displayName: 'Lokalny użytkownik' };
/** Limit dla providera lokalnego — bezpieczny margines poniżej quoty localStorage. */
const LOCAL_LIMIT_BYTES = 4 * 1024 * 1024;

interface LocalIndex {
  projects: StoredProject[];
}

const readIndex = (): LocalIndex => {
  try {
    const raw = localStorage.getItem(LOCAL_INDEX_KEY);
    if (!raw) return { projects: [] };
    const parsed = JSON.parse(raw) as LocalIndex;
    return { projects: Array.isArray(parsed.projects) ? parsed.projects : [] };
  } catch {
    return { projects: [] };
  }
};

const writeIndex = (index: LocalIndex): void => {
  localStorage.setItem(LOCAL_INDEX_KEY, JSON.stringify(index));
};

const byteSize = (s: string): number => new Blob([s]).size;

const toMeta = ({ json: _json, ...meta }: StoredProject): StoredProjectMeta => meta;

export class LocalProjectStorageProvider implements ProjectStorageProvider {
  readonly kind = 'local' as const;

  async getCurrentUser(): Promise<StorageUser> {
    return LOCAL_USER;
  }

  async listProjects(): Promise<StoredProjectMeta[]> {
    return readIndex().projects.map(toMeta)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async loadProject(id: string): Promise<StoredProject | null> {
    return readIndex().projects.find(p => p.id === id) ?? null;
  }

  async saveProject(input: { id?: string; name: string; json: string }): Promise<StoredProjectMeta> {
    const index = readIndex();
    const now = new Date().toISOString();
    const sizeBytes = byteSize(input.json);

    const existing = input.id ? index.projects.find(p => p.id === input.id) : undefined;
    const otherBytes = index.projects
      .filter(p => p.id !== existing?.id)
      .reduce((sum, p) => sum + p.sizeBytes, 0);
    if (otherBytes + sizeBytes > LOCAL_LIMIT_BYTES) {
      throw new Error(
        `Przekroczono limit miejsca (${(LOCAL_LIMIT_BYTES / 1024 / 1024).toFixed(0)} MB). ` +
        `Usuń stare projekty albo zmniejsz tekstury.`
      );
    }

    if (existing) {
      existing.name = input.name;
      existing.json = input.json;
      existing.sizeBytes = sizeBytes;
      existing.updatedAt = now;
      writeIndex(index);
      return toMeta(existing);
    }

    const project: StoredProject = {
      id: `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: input.name,
      ownerId: LOCAL_USER.id,
      visibility: 'private',
      license: 'all-rights-reserved',
      sizeBytes,
      createdAt: now,
      updatedAt: now,
      json: input.json,
    };
    index.projects.push(project);
    writeIndex(index);
    return toMeta(project);
  }

  async deleteProject(id: string): Promise<void> {
    const index = readIndex();
    index.projects = index.projects.filter(p => p.id !== id);
    writeIndex(index);
  }

  async getQuota(): Promise<StorageQuota> {
    const usedBytes = readIndex().projects.reduce((sum, p) => sum + p.sizeBytes, 0);
    return { usedBytes, limitBytes: LOCAL_LIMIT_BYTES };
  }

  async setSharing(id: string, visibility: ProjectVisibility, license: ProjectLicense): Promise<StoredProjectMeta> {
    const index = readIndex();
    const project = index.projects.find(p => p.id === id);
    if (!project) throw new Error(`Projekt ${id} nie istnieje`);
    project.visibility = visibility;
    project.license = license;
    project.updatedAt = new Date().toISOString();
    writeIndex(index);
    return toMeta(project);
  }
}

/**
 * Fabryka providera: chmura (Supabase), gdy skonfigurowano VITE_SUPABASE_URL
 * i VITE_SUPABASE_PUB (patrz SUPABASE_SETUP.md); inaczej provider lokalny.
 * Import dynamiczny — bundle bez konfiguracji nie ciągnie SDK na start.
 */
export async function createProjectStorage(): Promise<ProjectStorageProvider> {
  const { getSupabaseConfig, SupabaseProjectStorageProvider } = await import('./supabaseStorage');
  if (getSupabaseConfig()) {
    return new SupabaseProjectStorageProvider();
  }
  return new LocalProjectStorageProvider();
}

/** Synchronicznie: czy skonfigurowano backend chmurowy (do UI). */
export function isCloudConfigured(): boolean {
  const env = import.meta.env;
  return Boolean(env?.VITE_SUPABASE_URL && (env?.VITE_SUPABASE_PUB ?? env?.VITE_SUPABASE_ANON_KEY));
}
