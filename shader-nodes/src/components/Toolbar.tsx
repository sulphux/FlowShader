import React from 'react';

interface Props {
  onSave: () => void;
  onLoad: () => void;
  onClear: () => void;
  onShowCode: () => void; // <--- NOWY PROP
}

export default function Toolbar({ onSave, onLoad, onClear, onShowCode }: Props) {
  const btnStyle: React.CSSProperties = {
    background: '#333',
    border: '1px solid #555',
    color: '#eee',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    transition: 'background 0.2s',
  };
  const hoverStyle = (e: React.MouseEvent) => { e.currentTarget.style.background = '#444'; };
  const leaveStyle = (e: React.MouseEvent) => { e.currentTarget.style.background = '#333'; };

  return (
    <div style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      zIndex: 10,
      display: 'flex',
      gap: '8px',
      background: '#1a1a1a',
      padding: '8px',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
    }}>
      <button onClick={onSave} style={btnStyle} onMouseEnter={hoverStyle} onMouseLeave={leaveStyle}>💾 Save JSON</button>
      <button onClick={onLoad} style={btnStyle} onMouseEnter={hoverStyle} onMouseLeave={leaveStyle}>📂 Load JSON</button>
      
      <div style={{ width: '1px', background: '#444', margin: '0 4px' }}></div>
      
      {/* NOWY PRZYCISK */}
      <button onClick={onShowCode} style={{ ...btnStyle, color: '#81c784', borderColor: '#2e7d32' }} onMouseEnter={(e) => e.currentTarget.style.background = '#1b5e20'} onMouseLeave={leaveStyle}>
        {'< > Code'}
      </button>

      <div style={{ width: '1px', background: '#444', margin: '0 4px' }}></div>

      <button onClick={onClear} style={{ ...btnStyle, borderColor: '#722', color: '#f88' }} onMouseEnter={(e) => e.currentTarget.style.background = '#411'} onMouseLeave={(e) => e.currentTarget.style.background = '#333'}>
         🗑️ Clear
      </button>
    </div>
  );
}