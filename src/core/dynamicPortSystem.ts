import type { Edge, Node } from 'reactflow';
import type { ShaderNodeDefinition } from './types';
import { computeSmartSplitPorts } from './smartSplitAdapter';

type VectorType = 'vec2' | 'vec3' | 'vec4';

const VECTOR_TYPES: VectorType[] = ['vec2', 'vec3', 'vec4'];

const isVectorType = (type: string | undefined): type is VectorType =>
  Boolean(type && VECTOR_TYPES.includes(type as VectorType));

const samePorts = (
  current: Array<{ id: string; label: string; type: string }>,
  next: Array<{ id: string; label: string; type: string }>,
): boolean => JSON.stringify(current) === JSON.stringify(next);

const withPorts = (
  node: Node,
  inputs: Array<{ id: string; label: string; type: string }>,
  outputs: Array<{ id: string; label: string; type: string }>,
  detectedType?: string,
): Node => {
  const def = node.data.definition as ShaderNodeDefinition;
  const detectedUnchanged = detectedType === undefined || node.data.detectedType === detectedType;
  if (samePorts(def.inputs, inputs) && samePorts(def.outputs, outputs) && detectedUnchanged) return node;

  return {
    ...node,
    data: {
      ...node.data,
      ...(detectedType === undefined ? {} : { detectedType }),
      definition: { ...def, inputs, outputs },
    },
  };
};

/**
 * Detects an unambiguous top-level vector constructor in a Code expression.
 * `vec4(a, b, c, d)` is vec4, while `vec4(a).x` and `dot(vec4(a), b)` are
 * deliberately left alone because their result is scalar.
 */
export function inferCodeExpressionType(value: unknown): VectorType | undefined {
  if (typeof value !== 'string') return undefined;
  let expression = value.trim();

  // Peel redundant parentheses only when they wrap the entire expression.
  let changed = true;
  while (changed && expression.startsWith('(') && expression.endsWith(')')) {
    changed = false;
    let depth = 0;
    for (let index = 0; index < expression.length; index += 1) {
      const character = expression[index];
      if (character === '(') depth += 1;
      if (character === ')') depth -= 1;
      if (depth === 0) {
        if (index === expression.length - 1) {
          expression = expression.slice(1, -1).trim();
          changed = true;
        }
        break;
      }
    }
  }

  const match = /^(vec[234])\s*\(/.exec(expression);
  if (!match || !isVectorType(match[1])) return undefined;

  const openIndex = expression.indexOf('(', match[0].length - 1);
  let depth = 0;
  for (let index = openIndex; index < expression.length; index += 1) {
    const character = expression[index];
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (depth === 0) {
      return expression.slice(index + 1).trim() === '' ? match[1] : undefined;
    }
  }

  return undefined;
}

export function computeSmartComposePorts(type: string): {
  inputs: Array<{ id: string; label: string; type: 'float' }>;
  outputs: Array<{ id: 'out'; label: string; type: string }>;
} {
  const component = (id: 'x' | 'y' | 'z' | 'w', label: string) => ({ id, label, type: 'float' as const });
  if (type === 'vec2') {
    return {
      inputs: [component('x', 'X'), component('y', 'Y')],
      outputs: [{ id: 'out', label: 'Vec2', type: 'vec2' }],
    };
  }
  if (type === 'vec4') {
    return {
      inputs: [component('x', 'X'), component('y', 'Y'), component('z', 'Z'), component('w', 'W')],
      outputs: [{ id: 'out', label: 'Vec4', type: 'vec4' }],
    };
  }
  if (type === 'vec3') {
    return {
      inputs: [component('x', 'X'), component('y', 'Y'), component('z', 'Z')],
      outputs: [{ id: 'out', label: 'Vec3', type: 'vec3' }],
    };
  }
  return {
    inputs: [component('x', 'X'), component('y', 'Y'), component('z', 'Z'), component('w', 'W')],
    outputs: [{ id: 'out', label: 'Auto', type: 'auto' }],
  };
}

const outputType = (node: Node | undefined, handle: string | null | undefined): string | undefined => {
  const def = node?.data?.definition as ShaderNodeDefinition | undefined;
  return def?.outputs.find(port => port.id === handle)?.type ?? def?.outputs[0]?.type;
};

const inputType = (node: Node | undefined, handle: string | null | undefined): string | undefined => {
  const def = node?.data?.definition as ShaderNodeDefinition | undefined;
  return def?.inputs.find(port => port.id === handle)?.type ?? def?.inputs[0]?.type;
};

const preferredVectorFromMultiType = (type: string | undefined): VectorType | undefined => {
  if (!type) return undefined;
  if (isVectorType(type)) return type;
  return type.split('|').find(isVectorType);
};

const inferComposeTypeFromComponents = (nodeId: string, edges: Edge[]): VectorType | undefined => {
  const handles = new Set(edges.filter(edge => edge.target === nodeId).map(edge => edge.targetHandle));
  if (handles.has('w')) return 'vec4';
  if (handles.has('z')) return 'vec3';
  if (handles.has('x') || handles.has('y')) return 'vec2';
  return undefined;
};

/**
 * Reconciles every node whose port shape/type is runtime-editable. This is
 * intentionally pure and shared by file loading, custom-node loading, and
 * the live editor, so those three paths cannot silently diverge again.
 */
export function reconcileDynamicPorts(nodes: Node[], edges: Edge[]): Node[] {
  let nextNodes = nodes.map(node => {
    const def = node.data?.definition as ShaderNodeDefinition | undefined;
    if (def?.id !== 'code_glsl') return node;
    const inferred = inferCodeExpressionType(node.data.value);
    if (!inferred || def.outputs[0]?.type === inferred) return node;
    return withPorts(node, def.inputs, [{ id: 'out', label: 'Out', type: inferred }]);
  });

  nextNodes = nextNodes.map(node => {
    const def = node.data?.definition as ShaderNodeDefinition | undefined;
    if (!def) return node;

    if (def.id === 'smart_split') {
      const incoming = edges.find(edge => edge.target === node.id && edge.targetHandle === 'in');
      const source = nextNodes.find(candidate => candidate.id === incoming?.source);
      const connectedType = outputType(source, incoming?.sourceHandle);
      const forcedType = node.data.forcedType as string | undefined;
      const type = forcedType && forcedType !== 'auto'
        ? forcedType
        : connectedType && connectedType !== 'auto'
          ? connectedType
          : def.inputs[0]?.type;
      if (!type || type === 'auto') return node;
      const adapted = computeSmartSplitPorts(type);
      return withPorts(node, [{ id: 'in', label: adapted.inputLabel, type }], adapted.outputs);
    }

    if (def.id === 'smart_compose') {
      const forcedType = node.data.forcedType as string | undefined;
      const savedType = def.outputs[0]?.type;
      const outgoing = edges.find(edge => edge.source === node.id && edge.sourceHandle === 'out');
      const target = nextNodes.find(candidate => candidate.id === outgoing?.target);
      const downstreamType = preferredVectorFromMultiType(inputType(target, outgoing?.targetHandle));
      const type = forcedType && forcedType !== 'auto'
        ? forcedType
        : isVectorType(savedType)
          ? savedType
          : downstreamType ?? inferComposeTypeFromComponents(node.id, edges);
      if (!type) return node;
      const adapted = computeSmartComposePorts(type);
      return withPorts(node, adapted.inputs, adapted.outputs);
    }

    if (def.id === 'relay_auto') {
      const incoming = edges.find(edge => edge.target === node.id && edge.targetHandle === 'in');
      const outgoing = edges.find(edge => edge.source === node.id && edge.sourceHandle === 'out');
      const source = nextNodes.find(candidate => candidate.id === incoming?.source);
      const target = nextNodes.find(candidate => candidate.id === outgoing?.target);
      const type = outputType(source, incoming?.sourceHandle)
        ?? inputType(target, outgoing?.targetHandle)
        ?? def.inputs[0]?.type;
      if (!type || type === 'auto') return node;
      return withPorts(
        node,
        [{ id: 'in', label: type, type }],
        [{ id: 'out', label: type, type }],
      );
    }

    return node;
  });

  // Custom ports consume the already-reconciled auto-node types above.
  nextNodes = nextNodes.map(node => {
    const def = node.data?.definition as ShaderNodeDefinition | undefined;
    if (!def || node.data.forcedType) return node;

    if (def.id === 'custom_output') {
      const incoming = edges.find(edge => edge.target === node.id && edge.targetHandle === 'in');
      const source = nextNodes.find(candidate => candidate.id === incoming?.source);
      const type = outputType(source, incoming?.sourceHandle);
      if (!type || type === 'auto' || type.includes('|')) return node;
      return withPorts(node, [{ id: 'in', label: 'Value', type }], def.outputs, type);
    }

    if (def.id === 'custom_input') {
      const outgoing = edges.find(edge => edge.source === node.id && edge.sourceHandle === 'out');
      const target = nextNodes.find(candidate => candidate.id === outgoing?.target);
      const type = inputType(target, outgoing?.targetHandle);
      if (!type || type === 'auto' || type.includes('|')) return node;
      return withPorts(node, def.inputs, [{ id: 'out', label: 'Value', type }], type);
    }

    return node;
  });

  return nextNodes;
}

