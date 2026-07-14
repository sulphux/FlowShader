import { createPortal } from 'react-dom';
import { useI18n } from '../core/i18n';
import { TYPE_COLORS } from '../core/theme';
import { vectorComponents, type InlinePortDirection, type VectorType } from '../core/inlinePortAdapters';

interface Props {
  x: number;
  y: number;
  direction: InlinePortDirection;
  portLabel: string;
  portType: VectorType;
  expanded: boolean;
  canCollapse: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export default function InlinePortContextMenu({
  x, y, direction, portLabel, portType, expanded, canCollapse, onToggle, onClose,
}: Props) {
  const { text } = useI18n();
  const components = vectorComponents(portType).map(component => component.toUpperCase()).join(' / ');
  const blocked = expanded && !canCollapse;
  const action = expanded
    ? text('Collapse components', 'Zwiń składowe')
    : text(`Split into ${components}`, `Rozdziel na ${components}`);

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 120000 }}
      onClick={onClose}
      onContextMenu={(event) => { event.preventDefault(); onClose(); }}
    >
      <div
        role="menu"
        aria-label={`${portLabel} ${portType} port actions`}
        onClick={(event) => event.stopPropagation()}
        style={{
          position: 'fixed', left: Math.min(x, window.innerWidth - 235), top: Math.min(y, window.innerHeight - 135), minWidth: '220px', padding: '5px',
          border: '1px solid #4a4a4a', borderRadius: '7px', background: '#191919',
          boxShadow: '0 8px 26px rgba(0,0,0,.82)', color: '#ddd', fontFamily: 'sans-serif',
        }}
      >
        <div style={{ padding: '5px 8px 7px', borderBottom: '1px solid #333', fontSize: '11px', color: '#aaa' }}>
          <strong style={{ color: TYPE_COLORS[portType] }}>{portLabel}</strong>
          {' · '}{portType} · {direction === 'input' ? text('input', 'wejście') : text('output', 'wyjście')}
        </div>
        <button
          type="button"
          role="menuitem"
          disabled={blocked}
          onClick={() => { if (!blocked) { onToggle(); onClose(); } }}
          style={{
            display: 'block', width: '100%', marginTop: '4px', padding: '8px 9px',
            border: 0, borderRadius: '4px', background: 'transparent', textAlign: 'left',
            color: blocked ? '#666' : '#eee', cursor: blocked ? 'not-allowed' : 'pointer', fontSize: '12px',
          }}
        >
          {expanded ? '◀' : '⑂'} {action}
        </button>
        <div style={{ padding: '2px 9px 6px', maxWidth: '250px', color: blocked ? '#d69a5d' : '#777', fontSize: '10px', lineHeight: 1.35 }}>
          {blocked
            ? text('Disconnect component wires before collapsing.', 'Odłącz przewody składowych przed zwinięciem.')
            : text('Components stay inside this node; no adapter node is added.', 'Składowe pozostają wewnątrz noda; adapter nie jest dodawany.')}
        </div>
      </div>
    </div>,
    document.body,
  );
}
