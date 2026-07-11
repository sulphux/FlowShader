/**
 * Wspólna logika adaptacji portów dla Split (Auto) — jakiego typu wejście
 * dostał (albo zostało wymuszone kliknięciem), takie porty X/Y/Z/W wystawia.
 *
 * Było zduplikowane w 3 miejscach (graphRehydration.ts przy wczytaniu,
 * NodeEditor.tsx przy łączeniu kablem i przy drag-to-add) — każda kopia
 * mogła się rozjechać niezależnie. Teraz wszystkie korzystają z tej samej
 * funkcji; UI (kliknięcie badge w ShaderNode.tsx) też.
 */

export interface SmartSplitPort {
  id: string;
  label: string;
  type: string;
}

export interface SmartSplitAdaptation {
  inputLabel: string;
  outputs: SmartSplitPort[];
}

const floatPort = (id: string, label: string): SmartSplitPort => ({ id, label, type: 'float' });

export function computeSmartSplitPorts(type: string): SmartSplitAdaptation {
  if (type === 'vec2') return { inputLabel: 'Vec2', outputs: [floatPort('x', 'X'), floatPort('y', 'Y')] };
  if (type === 'vec3') return { inputLabel: 'Vec3', outputs: [floatPort('x', 'R'), floatPort('y', 'G'), floatPort('z', 'B')] };
  if (type === 'vec4') return { inputLabel: 'Vec4', outputs: [floatPort('x', 'R'), floatPort('y', 'G'), floatPort('z', 'B'), floatPort('w', 'A')] };
  if (type === 'float') return { inputLabel: 'Float', outputs: [floatPort('x', 'Value')] };
  return { inputLabel: 'Input', outputs: [{ id: 'auto', label: 'Auto', type: 'auto' }] };
}

/** Kolejność cyklu przy klikaniu badge na Split (Auto). */
export const SMART_SPLIT_TYPE_CYCLE = ['float', 'vec2', 'vec3', 'vec4'] as const;
