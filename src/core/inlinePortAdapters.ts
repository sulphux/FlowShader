import type { ShaderNodeDefinition } from './types';

export type VectorType = 'vec2' | 'vec3' | 'vec4';
export type VectorComponent = 'x' | 'y' | 'z' | 'w';
export type InlinePortDirection = 'input' | 'output';

const INLINE_PREFIX = '__inline_port__';

export function isVectorType(type: string): type is VectorType {
  return type === 'vec2' || type === 'vec3' || type === 'vec4';
}

export function vectorComponents(type: string): VectorComponent[] {
  if (type === 'vec2') return ['x', 'y'];
  if (type === 'vec3') return ['x', 'y', 'z'];
  if (type === 'vec4') return ['x', 'y', 'z', 'w'];
  return [];
}

export function inlinePortHandleId(
  direction: InlinePortDirection,
  portId: string,
  component: VectorComponent,
): string {
  return `${INLINE_PREFIX}|${direction}|${portId}|${component}`;
}

export interface ParsedInlinePortHandle {
  direction: InlinePortDirection;
  portId: string;
  component: VectorComponent;
}

export function parseInlinePortHandle(handleId: string | null | undefined): ParsedInlinePortHandle | null {
  if (!handleId?.startsWith(`${INLINE_PREFIX}|`)) return null;
  const parts = handleId.split('|');
  if (parts.length !== 4) return null;
  const direction = parts[1];
  const component = parts[3];
  if ((direction !== 'input' && direction !== 'output') || !['x', 'y', 'z', 'w'].includes(component)) {
    return null;
  }
  return { direction, portId: parts[2], component: component as VectorComponent };
}

export function inlineHandleType(
  definition: ShaderNodeDefinition,
  handleId: string | null,
): 'float' | null {
  const parsed = parseInlinePortHandle(handleId);
  if (!parsed) return null;
  const ports = parsed.direction === 'input' ? definition.inputs : definition.outputs;
  const port = ports.find(candidate => candidate.id === parsed.portId);
  return port && vectorComponents(port.type).includes(parsed.component) ? 'float' : null;
}

export function relatedInputHandles(portId: string, type: string): string[] {
  return [portId, ...vectorComponents(type).map(component => inlinePortHandleId('input', portId, component))];
}
