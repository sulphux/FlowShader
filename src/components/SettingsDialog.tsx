import { useState } from 'react';
import { getGlobalSettings, updateGlobalSettings, type GlobalSettings } from '../core/globalSettings';
import { VERSION_LABEL, BUILD_DATE } from '../core/version';

interface Props {
  onClose: () => void;
}

/** Globalne ustawienia renderowania: limit FPS i skala jakości (rozdzielczości). */
export default function SettingsDialog({ onClose }: Props) {
  const [settings, setSettings] = useState<GlobalSettings>(getGlobalSettings());

  const apply = (patch: Partial<GlobalSettings>) => {
    setSettings(updateGlobalSettings(patch));
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px'
  };
  const labelStyle: React.CSSProperties = { fontSize: '12px', color: '#ccc' };
  const optionButton = (active: boolean): React.CSSProperties => ({
    padding: '4px 10px', fontSize: '11px', cursor: 'pointer', borderRadius: '4px',
    background: active ? '#ff007a' : '#333', color: '#fff',
    border: '1px solid #555', fontWeight: 'bold'
  });

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1a1a1a', border: '1px solid #444', borderRadius: '10px',
          padding: '16px 20px', minWidth: '320px', color: '#fff', fontFamily: 'sans-serif',
          boxShadow: '0 12px 40px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', gap: '14px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: '14px' }}>⚙️ Global Settings</strong>
          <button onClick={onClose} title="Close" style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '14px' }}>✕</button>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Limit FPS</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {([0, 30, 60] as const).map(fps => (
              <button key={fps} style={optionButton(settings.fpsLimit === fps)} onClick={() => apply({ fpsLimit: fps })}>
                {fps === 0 ? 'Bez limitu' : `${fps}`}
              </button>
            ))}
          </div>
        </div>

        <div style={rowStyle}>
          <span style={labelStyle}>Jakość renderowania</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {([0.5, 0.75, 1] as const).map(scale => (
              <button key={scale} style={optionButton(settings.resolutionScale === scale)} onClick={() => apply({ resolutionScale: scale })}>
                {Math.round(scale * 100)}%
              </button>
            ))}
          </div>
        </div>

        <div style={{ fontSize: '10px', color: '#666', borderTop: '1px solid #333', paddingTop: '8px' }}>
          Ustawienia dotyczą wszystkich okien podglądu i są zapamiętywane w przeglądarce.
        </div>

        <div style={{ fontSize: '10px', color: '#555', display: 'flex', justifyContent: 'space-between' }}>
          <span>FlowShader {VERSION_LABEL}</span>
          <span>{new Date(BUILD_DATE).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}
