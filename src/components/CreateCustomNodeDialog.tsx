import React, { useState } from 'react';

interface Props {
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
}

export default function CreateCustomNodeDialog({ onClose, onCreate }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = () => {
    if (!name.trim()) {
      alert('Please enter a name for the custom node.');
      return;
    }
    onCreate(name.trim(), description.trim());
    onClose();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px',
    background: '#222',
    border: '1px solid #555',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '13px',
    fontFamily: 'sans-serif'
  };

  const btnStyle: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    transition: 'background 0.2s'
  };

  return (
    <div 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        background: 'rgba(0,0,0,0.8)', 
        zIndex: 200000, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }} 
      onClick={onClose}
    >
      <div 
        style={{ 
          background: '#1a1a1a', 
          padding: '24px', 
          borderRadius: '8px', 
          border: '1px solid #444', 
          width: '400px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.9)'
        }} 
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '18px' }}>
          📦 Create Custom Node
        </h2>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'block', marginBottom: '4px', color: '#aaa', fontSize: '12px' }}>
            Name *
          </label>
          <input 
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Custom Effect"
            style={inputStyle}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') onClose();
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '4px', color: '#aaa', fontSize: '12px' }}>
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this custom node do?"
            style={{ ...inputStyle, minHeight: '60px', resize: 'vertical', fontFamily: 'sans-serif' }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button 
            onClick={onClose}
            style={{ ...btnStyle, background: '#333', color: '#ccc' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#444'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#333'}
          >
            Cancel
          </button>
          <button 
            onClick={handleCreate}
            style={{ ...btnStyle, background: '#ff007a', color: '#fff' }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#e6006d'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#ff007a'}
          >
            Create
          </button>
        </div>

        <div style={{ marginTop: '16px', padding: '8px', background: '#222', borderRadius: '4px', fontSize: '11px', color: '#888' }}>
          💡 <strong>Tip:</strong> Use "Custom Input" and "Custom Output" nodes inside to define the interface.
        </div>
      </div>
    </div>
  );
}
