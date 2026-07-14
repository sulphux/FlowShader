import React from 'react';
import { useI18n } from '../core/i18n';

interface Props {
  onSave: (saveAs?: boolean) => void;
  onLoad: () => void;
  onShowExamples: () => void;
  onClear: () => void;
  onNew: () => void;
  onFitView: () => void;
  onShowCode: () => void;
  onShowSettings?: () => void;
  onShowCloud?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  currentFile?: string | null;
}

export default function Toolbar({ onSave, onLoad, onShowExamples, onClear, onNew, onFitView, onShowCode, onShowSettings, onShowCloud, onUndo, onRedo, canUndo, canRedo, currentFile }: Props) {
  const { language, setLanguage, text } = useI18n();
  const btnStyle: React.CSSProperties = {
    background: '#333',
    border: '1px solid #555',
    color: '#eee',
    padding: '6px 9px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    transition: 'background 0.2s',
  };
  const hoverStyle = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = '#444'; };
  const leaveStyle = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = '#333'; };

  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      zIndex: 10,
      display: 'flex',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: '6px',
      maxWidth: 'calc(100% - 20px)',
      boxSizing: 'border-box',
      background: '#1a1a1a',
      padding: '8px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
    }}>
      {currentFile && (
        <div style={{ ...btnStyle, background: '#1a1a1a', cursor: 'default', color: '#888', fontSize: '11px', padding: '6px 8px' }}>
          📄 {currentFile}
        </div>
      )}
      
      <button onClick={onNew} style={{ ...btnStyle, color: '#81c784', borderColor: '#2e7d32' }} onMouseEnter={(e) => e.currentTarget.style.background = '#1b5e20'} onMouseLeave={leaveStyle} title={text('New project', 'Nowy projekt')}>
        📄 {text('New', 'Nowy')}
      </button>
      <button onClick={() => onSave(false)} style={btnStyle} onMouseEnter={hoverStyle} onMouseLeave={leaveStyle} title={text('Save (Ctrl+S)', 'Zapisz (Ctrl+S)')}>
        💾 {text('Save', 'Zapisz')}
      </button>
      <button onClick={() => onSave(true)} style={btnStyle} onMouseEnter={hoverStyle} onMouseLeave={leaveStyle} title={text('Save As…', 'Zapisz jako…')}>
        💾 {text('Save As…', 'Zapisz jako…')}
      </button>
      <button onClick={onLoad} style={btnStyle} onMouseEnter={hoverStyle} onMouseLeave={leaveStyle}>📂 {text('Load', 'Wczytaj')}</button>
      <button onClick={onShowExamples} style={{ ...btnStyle, color: '#c4b5fd', borderColor: '#6d5bd0' }} onMouseEnter={(e) => e.currentTarget.style.background = '#352d63'} onMouseLeave={leaveStyle} title={text('Browse built-in examples', 'Przeglądaj wbudowane przykłady')}>
        📚 {text('Examples', 'Przykłady')}
      </button>
      {onShowCloud && (
        <button onClick={onShowCloud} style={btnStyle} onMouseEnter={hoverStyle} onMouseLeave={leaveStyle} title={text('Cloud projects (sign-in and sharing)', 'Projekty w chmurze (logowanie i udostępnianie)')}>
          ☁️
        </button>
      )}
      
      <div style={{ width: '1px', background: '#444', margin: '0 4px' }}></div>
      
      <button onClick={onFitView} style={{ ...btnStyle, color: '#64b5f6', borderColor: '#1976d2' }} onMouseEnter={(e) => e.currentTarget.style.background = '#0d47a1'} onMouseLeave={leaveStyle} title={text('Fit all nodes in view', 'Dopasuj wszystkie nody do widoku')}>
        🔍 {text('Fit View', 'Dopasuj widok')}
      </button>
      
      <div style={{ width: '1px', background: '#444', margin: '0 4px' }}></div>
      
      {onUndo && (
        <button onClick={onUndo} disabled={!canUndo} style={{ ...btnStyle, opacity: canUndo ? 1 : 0.3, cursor: canUndo ? 'pointer' : 'not-allowed' }} onMouseEnter={canUndo ? hoverStyle : undefined} onMouseLeave={canUndo ? leaveStyle : undefined} title={text('Undo (Ctrl+Z)', 'Cofnij (Ctrl+Z)')}>
          ↶ {text('Undo', 'Cofnij')}
        </button>
      )}
      {onRedo && (
        <button onClick={onRedo} disabled={!canRedo} style={{ ...btnStyle, opacity: canRedo ? 1 : 0.3, cursor: canRedo ? 'pointer' : 'not-allowed' }} onMouseEnter={canRedo ? hoverStyle : undefined} onMouseLeave={canRedo ? leaveStyle : undefined} title={text('Redo (Ctrl+Y)', 'Ponów (Ctrl+Y)')}>
          ↷ {text('Redo', 'Ponów')}
        </button>
      )}
      
      <div style={{ width: '1px', background: '#444', margin: '0 4px' }}></div>
      
      {/* NOWY PRZYCISK */}
      <button onClick={onShowCode} style={{ ...btnStyle, color: '#81c784', borderColor: '#2e7d32' }} onMouseEnter={(e) => e.currentTarget.style.background = '#1b5e20'} onMouseLeave={leaveStyle}>
        {'< > '}{text('Code', 'Kod')}
      </button>

      <div style={{ width: '1px', background: '#444', margin: '0 4px' }}></div>

      {onShowSettings && (
        <button onClick={onShowSettings} style={btnStyle} onMouseEnter={hoverStyle} onMouseLeave={leaveStyle} title={text('Global settings (FPS and quality)', 'Ustawienia globalne (FPS i jakość)')}>
          ⚙️
        </button>
      )}

      <button onClick={onClear} style={{ ...btnStyle, borderColor: '#722', color: '#f88' }} onMouseEnter={(e) => e.currentTarget.style.background = '#411'} onMouseLeave={(e) => e.currentTarget.style.background = '#333'}>
         🗑️ {text('Clear', 'Wyczyść')}
      </button>

      <button
        onClick={() => setLanguage(language === 'en' ? 'pl' : 'en')}
        style={{ ...btnStyle, minWidth: '58px', color: '#ffd166', borderColor: '#7a6429' }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#4b3d19'}
        onMouseLeave={leaveStyle}
        aria-label={text('Language: English. Switch to Polish', 'Język: polski. Przełącz na angielski')}
        title={text('English interface · click for Polish', 'Polski interfejs · kliknij, aby przełączyć na angielski')}
      >
        🌐 {language.toUpperCase()}
      </button>
    </div>
  );
}
