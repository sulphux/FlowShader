import React from 'react';

interface NavigationPanelProps {
  breadcrumbs: string[];
  currentContext: string;
  onNavigateToLevel: (levelIndex: number) => void;
  onNavigateBack: () => void;
  onNavigateToMain: () => void;
}

export default function NavigationPanel({ 
  breadcrumbs, 
  currentContext, 
  onNavigateToLevel, 
  onNavigateBack, 
  onNavigateToMain 
}: NavigationPanelProps) {
  // Don't show panel in Main view
  if (currentContext === 'Main') return null;

  return (
    <div style={{
      position: 'absolute',
      top: '80px',
      left: '10px',
      zIndex: 100,
      background: 'rgba(138, 43, 226, 0.15)',
      border: '2px solid #8a2be2',
      borderRadius: '8px',
      padding: '12px 16px',
      backdropFilter: 'blur(8px)',
      boxShadow: '0 4px 20px rgba(138, 43, 226, 0.3)',
      maxWidth: '600px',
    }}>
      {/* Big banner */}
      <div style={{
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: '8px',
        textShadow: '0 2px 4px rgba(0,0,0,0.5)'
      }}>
        ✏️ EDITING: {currentContext}
      </div>

      {/* Breadcrumb trail */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        marginBottom: '10px',
        fontSize: '13px',
        color: '#ddd',
      }}>
        <span>📍</span>
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={index}>
            {index > 0 && <span style={{ color: '#888' }}>›</span>}
            <button
              onClick={() => onNavigateToLevel(index)}
              style={{
                background: index === breadcrumbs.length - 1 ? '#8a2be2' : 'transparent',
                border: index === breadcrumbs.length - 1 ? '1px solid #8a2be2' : '1px solid #555',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: index === breadcrumbs.length - 1 ? 'bold' : 'normal',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (index !== breadcrumbs.length - 1) {
                  e.currentTarget.style.background = '#333';
                  e.currentTarget.style.borderColor = '#8a2be2';
                }
              }}
              onMouseLeave={(e) => {
                if (index !== breadcrumbs.length - 1) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = '#555';
                }
              }}
              title={`Jump to ${crumb}`}
            >
              {index === 0 ? '🏠 ' : '🔲 '}{crumb}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Quick navigation buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {breadcrumbs.length > 1 && (
          <button
            onClick={onNavigateBack}
            style={{
              background: '#333',
              border: '1px solid #666',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 'bold',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#444';
              e.currentTarget.style.borderColor = '#8a2be2';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#333';
              e.currentTarget.style.borderColor = '#666';
            }}
            title="Go back one level"
          >
            ← Up One Level
          </button>
        )}
        
        <button
          onClick={onNavigateToMain}
          style={{
            background: '#222',
            border: '1px solid #8a2be2',
            color: '#8a2be2',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 'bold',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#8a2be2';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#222';
            e.currentTarget.style.color = '#8a2be2';
          }}
          title="Exit to main view"
        >
          🏠 Exit to Main
        </button>
      </div>
    </div>
  );
}
