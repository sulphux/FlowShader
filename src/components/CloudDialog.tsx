import { useCallback, useEffect, useState } from 'react';
import {
  createProjectStorage,
  isCloudConfigured,
  type ProjectStorageProvider,
  type StorageUser,
  type StorageQuota,
  type StoredProjectMeta,
  type ProjectVisibility,
  type ProjectLicense,
} from '../core/projectStorage';

interface Props {
  onClose: () => void;
  /** Zwraca JSON bieżącego grafu (serializeGraph). */
  getProjectJson: () => string;
  /** Wczytuje projekt do edytora. */
  onLoadProject: (json: string, name: string) => void;
}

const VISIBILITY_LABELS: Record<ProjectVisibility, string> = {
  private: '🔒 Prywatny',
  unlisted: '🔗 Z linkiem',
  public: '🌍 Publiczny',
};

const LICENSE_LABELS: Record<ProjectLicense, string> = {
  'all-rights-reserved': 'Wszystkie prawa zastrzeżone',
  'cc-by': 'CC BY',
  'cc-by-nc': 'CC BY-NC',
  'cc0': 'CC0 (domena publiczna)',
};

const formatBytes = (bytes: number): string =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;

/** Panel projektów: logowanie (chmura), lista, zapis, udostępnianie, quota. */
export default function CloudDialog({ onClose, getProjectJson, onLoadProject }: Props) {
  const [provider, setProvider] = useState<ProjectStorageProvider | null>(null);
  const [user, setUser] = useState<StorageUser | null>(null);
  const [projects, setProjects] = useState<StoredProjectMeta[]>([]);
  const [quota, setQuota] = useState<StorageQuota | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [saveName, setSaveName] = useState('Mój projekt');

  const cloudConfigured = isCloudConfigured();

  const refresh = useCallback(async (p: ProjectStorageProvider) => {
    const currentUser = await p.getCurrentUser();
    setUser(currentUser);
    if (currentUser) {
      setProjects(await p.listProjects());
      setQuota(await p.getQuota());
    } else {
      setProjects([]);
      setQuota(null);
    }
  }, []);

  useEffect(() => {
    void createProjectStorage().then(async p => {
      setProvider(p);
      await refresh(p);
    }).catch(err => setStatus(String(err instanceof Error ? err.message : err)));
  }, [refresh]);

  const run = useCallback(async (action: () => Promise<void>) => {
    if (!provider) return;
    setStatus(null);
    try {
      await action();
      await refresh(provider);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    }
  }, [provider, refresh]);

  const inputStyle: React.CSSProperties = {
    background: '#111', border: '1px solid #444', borderRadius: '4px',
    color: '#eee', padding: '6px 8px', fontSize: '12px', flex: 1,
  };
  const buttonStyle: React.CSSProperties = {
    background: '#333', border: '1px solid #555', color: '#eee', padding: '6px 10px',
    borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold',
  };
  const accentButton: React.CSSProperties = { ...buttonStyle, background: '#ff007a', borderColor: '#ff007a' };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1a1a1a', border: '1px solid #444', borderRadius: '10px',
          padding: '16px 20px', width: '520px', maxHeight: '80vh', overflowY: 'auto',
          color: '#fff', fontFamily: 'sans-serif', boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
          display: 'flex', flexDirection: 'column', gap: '12px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: '14px' }}>
            ☁️ Projekty {provider?.kind === 'cloud' ? '(chmura)' : '(lokalnie)'}
          </strong>
          <button onClick={onClose} title="Close" style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '14px' }}>✕</button>
        </div>

        {!cloudConfigured && (
          <div style={{ fontSize: '11px', color: '#aaa', background: '#222', borderRadius: '6px', padding: '8px' }}>
            Backend chmurowy nie jest skonfigurowany — projekty zapisują się lokalnie w tej przeglądarce.
            Instrukcja podpięcia Supabase (logowanie, zapis online, limity, udostępnianie): <code>SUPABASE_SETUP.md</code>.
          </div>
        )}

        {/* --- LOGOWANIE (tylko chmura) --- */}
        {provider?.kind === 'cloud' && !user && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input style={inputStyle} type="email" placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
              <input style={inputStyle} type="password" placeholder="hasło" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button style={accentButton} onClick={() => run(async () => { await provider.signIn!(email, password); })}>Zaloguj</button>
              <button style={buttonStyle} onClick={() => run(async () => { await provider.signUp!(email, password); })}>Zarejestruj</button>
            </div>
          </div>
        )}

        {provider?.kind === 'cloud' && user && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#ccc' }}>
            <span>Zalogowano: <strong>{user.email ?? user.displayName}</strong></span>
            <button style={buttonStyle} onClick={() => run(async () => { await provider.signOut!(); })}>Wyloguj</button>
          </div>
        )}

        {/* --- QUOTA --- */}
        {quota && (
          <div>
            <div style={{ fontSize: '10px', color: '#888', marginBottom: '3px' }}>
              Miejsce: {formatBytes(quota.usedBytes)} / {formatBytes(quota.limitBytes)}
            </div>
            <div style={{ height: '6px', background: '#333', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                width: `${Math.min(100, (quota.usedBytes / quota.limitBytes) * 100)}%`,
                height: '100%',
                background: quota.usedBytes / quota.limitBytes > 0.9 ? '#f44' : '#ff007a',
              }} />
            </div>
          </div>
        )}

        {/* --- ZAPIS BIEŻĄCEGO --- */}
        {user && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <input style={inputStyle} value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="nazwa projektu" />
            <button
              style={accentButton}
              onClick={() => run(async () => {
                await provider!.saveProject({ name: saveName.trim() || 'Bez nazwy', json: getProjectJson() });
              })}
            >
              💾 Zapisz bieżący
            </button>
          </div>
        )}

        {/* --- LISTA PROJEKTÓW --- */}
        {user && projects.length === 0 && (
          <div style={{ fontSize: '11px', color: '#666', textAlign: 'center', padding: '10px' }}>Brak zapisanych projektów.</div>
        )}
        {projects.map(project => (
          <div key={project.id} style={{ background: '#222', borderRadius: '6px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '12px' }}>{project.name}</strong>
              <span style={{ fontSize: '10px', color: '#777' }}>
                {formatBytes(project.sizeBytes)} · {new Date(project.updatedAt).toLocaleString()}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                style={buttonStyle}
                onClick={() => run(async () => {
                  const full = await provider!.loadProject(project.id);
                  if (full) { onLoadProject(full.json, full.name); onClose(); }
                })}
              >
                📂 Wczytaj
              </button>
              <button
                style={buttonStyle}
                onClick={() => run(async () => {
                  await provider!.saveProject({ id: project.id, name: project.name, json: getProjectJson() });
                })}
                title="Nadpisz ten projekt bieżącym grafem"
              >
                💾 Nadpisz
              </button>
              {/* System licencyjny: udostępniam / nie udostępniam + licencja */}
              <select
                value={project.visibility}
                onChange={e => run(async () => {
                  await provider!.setSharing(project.id, e.target.value as ProjectVisibility, project.license);
                })}
                style={{ ...inputStyle, flex: 'none', width: 'auto', cursor: 'pointer' }}
              >
                {(Object.keys(VISIBILITY_LABELS) as ProjectVisibility[]).map(v => (
                  <option key={v} value={v}>{VISIBILITY_LABELS[v]}</option>
                ))}
              </select>
              {project.visibility !== 'private' && (
                <select
                  value={project.license}
                  onChange={e => run(async () => {
                    await provider!.setSharing(project.id, project.visibility, e.target.value as ProjectLicense);
                  })}
                  style={{ ...inputStyle, flex: 'none', width: 'auto', cursor: 'pointer' }}
                >
                  {(Object.keys(LICENSE_LABELS) as ProjectLicense[]).map(l => (
                    <option key={l} value={l}>{LICENSE_LABELS[l]}</option>
                  ))}
                </select>
              )}
              <button
                style={{ ...buttonStyle, color: '#f88', borderColor: '#722' }}
                onClick={() => { if (confirm(`Usunąć projekt "${project.name}"?`)) void run(async () => provider!.deleteProject(project.id)); }}
              >
                🗑️
              </button>
            </div>
          </div>
        ))}

        {status && (
          <div style={{ fontSize: '11px', color: '#f88', background: '#2a1515', borderRadius: '4px', padding: '6px 8px' }}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
