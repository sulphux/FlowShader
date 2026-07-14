import { useEffect, useState } from 'react';
import { BUILTIN_EXAMPLES, loadBuiltinExample } from '../core/builtinExamples';
import { useI18n } from '../core/i18n';

interface Props {
  onClose: () => void;
  onOpen: (json: string, title: string) => void;
}

export default function ExamplesDialog({ onClose, onOpen }: Props) {
  const { language, text } = useI18n();
  const [selectedId, setSelectedId] = useState(BUILTIN_EXAMPLES[0]?.id || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const selected = BUILTIN_EXAMPLES.find(example => example.id === selectedId);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const openSelected = async () => {
    if (!selected || loading) return;
    setLoading(true);
    setError('');
    try {
      onOpen(await loadBuiltinExample(selected.id), selected.title);
      onClose();
    } catch (cause) {
      console.error('Failed to load built-in example:', cause);
      setError(text('Could not load this example. The current graph was not changed.', 'Nie udało się wczytać przykładu. Bieżący graf nie został zmieniony.'));
      setLoading(false);
    }
  };

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px', background: 'rgba(3, 4, 8, 0.78)', backdropFilter: 'blur(8px)',
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="examples-title"
        onClick={event => event.stopPropagation()}
        style={{
          width: 'min(880px, 94vw)', maxHeight: 'min(720px, 90vh)', overflow: 'auto',
          border: '1px solid #3d3d50', borderRadius: '16px', color: '#f7f7fb',
          background: 'linear-gradient(145deg, #191922 0%, #101017 100%)',
          boxShadow: '0 28px 90px rgba(0,0,0,0.72)', fontFamily: 'sans-serif',
        }}
      >
        <header style={{ padding: '22px 24px 18px', borderBottom: '1px solid #30303d', display: 'flex', justifyContent: 'space-between', gap: '24px' }}>
          <div>
            <div style={{ color: '#9d8cff', fontSize: '11px', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>{text('FlowShader Gallery', 'Galeria FlowShader')}</div>
            <h2 id="examples-title" style={{ margin: '6px 0 4px', fontSize: '22px' }}>{text('Start from an example', 'Zacznij od przykładu')}</h2>
            <div style={{ color: '#9999aa', fontSize: '12px' }}>{text('Choose a graph, inspect it and make it yours.', 'Wybierz graf, przeanalizuj go i dostosuj do siebie.')}</div>
          </div>
          <button aria-label={text('Close examples', 'Zamknij przykłady')} onClick={onClose} style={{ alignSelf: 'flex-start', border: 0, background: '#292935', color: '#aaaabc', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '15px' }}>✕</button>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '12px', padding: '20px 24px' }}>
          {BUILTIN_EXAMPLES.map(example => {
            const active = example.id === selectedId;
            return (
              <button
                key={example.id}
                type="button"
                aria-pressed={active}
                onClick={() => { setSelectedId(example.id); setError(''); }}
                style={{
                  minHeight: '150px', padding: '16px', textAlign: 'left', cursor: 'pointer',
                  borderRadius: '12px', color: '#f4f4f8',
                  border: `1px solid ${active ? example.accent : '#353543'}`,
                  background: active ? `linear-gradient(135deg, ${example.accent}20, #20202a)` : '#1b1b24',
                  boxShadow: active ? `0 0 0 1px ${example.accent}55, 0 10px 28px rgba(0,0,0,0.28)` : 'none',
                  transition: 'border-color 120ms, transform 120ms, background 120ms',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <span aria-hidden="true" style={{ display: 'grid', placeItems: 'center', width: '42px', height: '42px', borderRadius: '11px', background: `${example.accent}20`, color: example.accent, fontSize: '24px', fontWeight: 900 }}>{example.icon}</span>
                  <span style={{ color: active ? example.accent : '#858596', fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{language === 'pl' ? example.categoryPl : example.category}</span>
                </div>
                <strong style={{ display: 'block', marginTop: '13px', fontSize: '15px' }}>{language === 'pl' ? example.titlePl : example.title}</strong>
                <span style={{ display: 'block', marginTop: '5px', color: '#aaaaba', fontSize: '11px', lineHeight: 1.45 }}>{language === 'pl' ? example.descriptionPl : example.description}</span>
                <span style={{ display: 'block', marginTop: '11px', color: '#707080', fontSize: '10px' }}>{example.stats}</span>
              </button>
            );
          })}
        </div>

        <footer style={{ padding: '16px 24px 20px', borderTop: '1px solid #30303d', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ color: '#c4c4d0', fontSize: '12px' }}>{text('Opening an example replaces the current canvas.', 'Otwarcie przykładu zastępuje bieżący canvas.')}</div>
            <div style={{ color: '#777788', fontSize: '10px', marginTop: '3px' }}>{text('Save the current project first if you want to keep a separate copy.', 'Najpierw zapisz bieżący projekt, jeśli chcesz zachować osobną kopię.')}</div>
            {error && <div role="alert" style={{ color: '#ff7a8a', fontSize: '11px', marginTop: '6px' }}>{error}</div>}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={{ padding: '9px 14px', borderRadius: '7px', border: '1px solid #454555', background: '#24242e', color: '#c8c8d2', cursor: 'pointer', fontWeight: 700 }}>{text('Cancel', 'Anuluj')}</button>
            <button
              onClick={() => void openSelected()}
              disabled={!selected || loading}
              style={{ padding: '9px 16px', borderRadius: '7px', border: `1px solid ${selected?.accent || '#6e5bff'}`, background: selected?.accent || '#6e5bff', color: '#08080d', cursor: loading ? 'wait' : 'pointer', fontWeight: 900, opacity: loading ? 0.65 : 1 }}
            >
              {loading ? text('Loading…', 'Wczytywanie…') : `${text('Open', 'Otwórz')} ${selected ? (language === 'pl' ? selected.titlePl : selected.title) : text('example', 'przykład')}`}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
