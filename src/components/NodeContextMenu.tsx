import React from 'react';

interface Props {
  x: number;
  y: number;
  nodeId: string;
  nodeName: string;
  isCustomNode: boolean;
  isLastOutput: boolean;
  onClose: () => void;
  onCopy: () => void;
  onCut: () => void;
  onDelete: () => void;
  onEditCustom?: () => void;
}

export default function NodeContextMenu({ 
  x, y, nodeName, isCustomNode, isLastOutput,
  onClose, onCopy, onCut, onDelete, onEditCustom 
}: Props) {
  
  const menuStyle: React.CSSProperties = {
    position: 'absolute',
    top: y,
    left: x,
    background: '#1a1a1a',
    border: '1px solid #444',
    borderRadius: '6px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
    padding: '4px',
    minWidth: '160px',
    zIndex: 100000,
    fontFamily: 'sans-serif',
    userSelect: 'none'
  };

  const itemStyle: React.CSSProperties = {
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#ccc',
    borderRadius: '4px',
    transition: 'background 0.1s'
  };

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div 
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 }} 
      onClick={onClose}
      onContextMenu={(e) => { e.preventDefault(); onClose(); }}
    >
      <div style={menuStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: '4px 8px', fontSize: '11px', color: '#888', borderBottom: '1px solid #333', marginBottom: '4px', fontWeight: 'bold' }}>
          {nodeName}
        </div>

        <div 
          onClick={() => handleAction(onCopy)} 
          style={itemStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#333'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ccc'; }}
        >
          📋 Copy (Ctrl+C)
        </div>

        <div 
          onClick={() => handleAction(onCut)} 
          style={itemStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#333'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ccc'; }}
        >
          ✂️ Cut (Ctrl+X)
        </div>

        {isCustomNode && onEditCustom && (
          <>
            <div style={{ height: '1px', background: '#333', margin: '4px 0' }}></div>
            <div 
              onClick={() => handleAction(onEditCustom)} 
              style={itemStyle}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#333'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ccc'; }}
            >
              🔧 Edit Definition
            </div>
          </>
        )}

        <div style={{ height: '1px', background: '#333', margin: '4px 0' }}></div>

        <div 
          onClick={() => {
            if (isLastOutput) {
              alert('Cannot delete the last Output node!\n\nAt least one Output node must remain in the graph.');
              return;
            }
            if (window.confirm(`Delete "${nodeName}"?`)) {
              handleAction(onDelete);
            }
          }}
          style={{ ...itemStyle, color: '#f88' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#411'; e.currentTarget.style.color = '#f88'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#f88'; }}
        >
          🗑️ Delete (Del)
        </div>
      </div>
    </div>
  );
}
