import { useState } from 'react';
import { TYPE_COLORS, TYPE_NAMES } from '../core/theme';

export default function Legend() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '20px',
      zIndex: 10,
      fontFamily: 'sans-serif',
      fontSize: '12px',
      color: '#eee',
      display: 'flex',
      alignItems: 'flex-end',
      flexDirection: 'column',
      gap: '10px'
    }}>
      {/* Przycisk Toggle */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: '#333',
          padding: '8px 12px',
          borderRadius: '20px',
          cursor: 'pointer',
          border: '1px solid #555',
          userSelect: 'none',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
          fontWeight: 'bold'
        }}
      >
        {isOpen ? '▼ Hide Legend' : '▲ Show Legend'}
      </div>

      {/* Lista (Wysuwana) */}
      <div style={{
        background: '#1e1e1e',
        border: '1px solid #444',
        borderRadius: '8px',
        padding: isOpen ? '12px' : '0',
        height: isOpen ? 'auto' : '0',
        opacity: isOpen ? 1 : 0,
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        width: '160px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      }}>
        {Object.entries(TYPE_NAMES).map(([type, label]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: TYPE_COLORS[type],
              marginRight: '10px',
              border: '1px solid rgba(255,255,255,0.2)'
            }} />
            <span>{label}</span>
          </div>
        ))}
        <div style={{ height: '1px', background: '#333', margin: '8px 0' }} />
        <div style={{ color: '#888', fontSize: '10px', textAlign: 'center' }}>
          Drag <strong>Vec</strong> to <strong>Float</strong><br/>to Auto-Split! 🪄
        </div>
      </div>
    </div>
  );
}