import { TYPE_COLORS } from '../core/theme';

interface Props {
  types: string; // e.g., "float|vec3"
  size?: number;
}

/**
 * Renders a split-colored circle for multi-type ports.
 * For "float|vec3", shows half yellow (float) and half green (vec3).
 */
export function MultiTypeIndicator({ types, size = 8 }: Props) {
  const typeList = types.split('|');
  
  // Single type - use solid color
  if (typeList.length === 1) {
    const type = typeList[0];
    const isAuto = type === 'auto';
    return (
      <div 
        className={isAuto ? 'port-auto-static' : ''}
        style={{ 
          width: `${size}px`, 
          height: `${size}px`, 
          borderRadius: '50%', 
          background: isAuto ? undefined : (TYPE_COLORS[type] || '#fff')
        }} 
      />
    );
  }

  // Multi-type - split circle into segments
  if (typeList.length === 2) {
    const [type1, type2] = typeList;
    const color1 = TYPE_COLORS[type1] || '#fff';
    const color2 = TYPE_COLORS[type2] || '#fff';
    
    return (
      <div 
        style={{ 
          width: `${size}px`, 
          height: `${size}px`, 
          borderRadius: '50%',
          background: `linear-gradient(90deg, ${color1} 0%, ${color1} 50%, ${color2} 50%, ${color2} 100%)`
        }} 
      />
    );
  }

  // 3+ types - use conic gradient
  if (typeList.length >= 3) {
    const segmentSize = 100 / typeList.length;
    const gradientStops = typeList.map((type, i) => {
      const color = TYPE_COLORS[type] || '#fff';
      const start = i * segmentSize;
      const end = (i + 1) * segmentSize;
      return `${color} ${start}%, ${color} ${end}%`;
    }).join(', ');

    return (
      <div 
        style={{ 
          width: `${size}px`, 
          height: `${size}px`, 
          borderRadius: '50%',
          background: `conic-gradient(${gradientStops})`
        }} 
      />
    );
  }

  return null;
}
