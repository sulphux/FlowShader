import { describe, it, expect, beforeEach } from 'vitest';
import { addCustomNode, loadCustomNodes, extractCustomNodePorts, type CustomNodeDefinition } from '../core/customNodeManager';
import { NODE_REGISTRY } from '../nodes';
import type { Node, Edge } from 'reactflow';

describe('Custom Node Regression Coverage', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.keys(NODE_REGISTRY)
      .filter(key => key.startsWith('custom_'))
      .forEach(key => delete NODE_REGISTRY[key]);
  });

  it('should persist multiple typed custom ports across save and load', () => {
    const customNode: CustomNodeDefinition = {
      id: 'custom_typed_bundle',
      label: 'Typed Bundle',
      description: '',
      compact: false,
      inputs: [
        { id: 'custom_input_a', label: 'A', type: 'float' },
        { id: 'custom_input_b', label: 'B', type: 'vec3' },
      ],
      outputs: [
        { id: 'custom_output_color', label: 'Color', type: 'vec4' },
        { id: 'custom_output_mask', label: 'Mask', type: 'float' },
      ],
      isCustom: true,
      subgraph: {
        nodes: [
          {
            id: 'custom_input_a',
            type: 'shaderNode',
            position: { x: 0, y: 0 },
            data: {
              definition: NODE_REGISTRY['custom_input'],
              value: 'A',
              detectedType: 'float',
            }
          },
          {
            id: 'custom_input_b',
            type: 'shaderNode',
            position: { x: 0, y: 100 },
            data: {
              definition: NODE_REGISTRY['custom_input'],
              value: 'B',
              detectedType: 'vec3',
            }
          },
          {
            id: 'custom_output_color',
            type: 'shaderNode',
            position: { x: 400, y: 0 },
            data: {
              definition: NODE_REGISTRY['custom_output'],
              value: 'Color',
              detectedType: 'vec4',
            }
          },
          {
            id: 'custom_output_mask',
            type: 'shaderNode',
            position: { x: 400, y: 100 },
            data: {
              definition: NODE_REGISTRY['custom_output'],
              value: 'Mask',
              detectedType: 'float',
            }
          }
        ] as Node[],
        edges: []
      },
      glslTemplate: () => 'vec4(1.0)',
    };

    addCustomNode(customNode);
    (NODE_REGISTRY as Record<string, CustomNodeDefinition>)['custom_typed_bundle'] = customNode;

    const loaded = loadCustomNodes();
    const restored = loaded[0];

    expect(restored.inputs.map(port => `${port.label}:${port.type}`)).toEqual(['A:float', 'B:vec3']);
    expect(restored.outputs.map(port => `${port.label}:${port.type}`)).toEqual(['Color:vec4', 'Mask:float']);
    const typedCustomNodes = restored.subgraph.nodes.filter(node => node.data?.detectedType);

    expect(typedCustomNodes).toHaveLength(4);
    expect(typedCustomNodes.map(node => `${node.id}:${node.data.detectedType}`)).toEqual([
      'custom_input_a:float',
      'custom_input_b:vec3',
      'custom_output_color:vec4',
      'custom_output_mask:float',
    ]);
  });

  it('should order ports by canvas Y position, not array/insertion order', () => {
    // custom_input_2 comes FIRST in the array but sits BELOW custom_input_1 on
    // the canvas (y=100 vs y=0) — port order must follow position (drag a
    // Custom Input/Output node up or down to reorder), not array order.
    const nodes: Node[] = [
      {
        id: 'custom_input_2',
        type: 'shaderNode',
        position: { x: 0, y: 100 },
        data: { definition: NODE_REGISTRY['custom_input'], label: 'Second', detectedType: 'vec2' }
      },
      {
        id: 'custom_output_1',
        type: 'shaderNode',
        position: { x: 400, y: 0 },
        data: { definition: NODE_REGISTRY['custom_output'], label: 'Result', detectedType: 'vec4' }
      },
      {
        id: 'custom_input_1',
        type: 'shaderNode',
        position: { x: 0, y: 0 },
        data: { definition: NODE_REGISTRY['custom_input'], label: 'First', detectedType: 'float' }
      }
    ];

    const ports = extractCustomNodePorts({ nodes });

    expect(ports.inputs).toEqual([
      { id: 'custom_input_1', label: 'First', type: 'float' },
      { id: 'custom_input_2', label: 'Second', type: 'vec2' },
    ]);
    expect(ports.outputs).toEqual([
      { id: 'custom_output_1', label: 'Result', type: 'vec4' },
    ]);
  });

  it('renaming a Custom Input/Output via the title header (data.label) propagates to the outer port name', () => {
    // Regression: extractCustomNodePorts used to read node.data.value, but the
    // only rename UI these nodes have is the standard title-input header,
    // which writes node.data.label — renames were silently ignored.
    //
    // Node ids are prefixed "custom_input"/"custom_output" so detection works
    // via the id-prefix fallback in extractCustomNodePorts — this file's
    // beforeEach wipes every "custom_"-prefixed registry entry (including the
    // built-in custom_input/custom_output definitions), so we can't rely on
    // NODE_REGISTRY['custom_input'] being populated here.
    const nodes: Node[] = [
      {
        id: 'custom_input_1',
        type: 'shaderNode',
        position: { x: 0, y: 0 },
        data: { definition: { id: 'custom_input' }, label: 'Renamed Input', detectedType: 'float' }
      },
      {
        id: 'custom_output_1',
        type: 'shaderNode',
        position: { x: 100, y: 0 },
        data: { definition: { id: 'custom_output' }, label: 'Renamed Output', detectedType: 'vec3' }
      }
    ];

    const ports = extractCustomNodePorts({ nodes });

    expect(ports.inputs[0].label).toBe('Renamed Input');
    expect(ports.outputs[0].label).toBe('Renamed Output');
  });

  it('a forced type overrides the auto-detected type when extracting ports', () => {
    const nodes: Node[] = [
      {
        id: 'custom_input_1',
        type: 'shaderNode',
        position: { x: 0, y: 0 },
        data: { definition: { id: 'custom_input' }, label: 'In', detectedType: 'float', forcedType: 'vec3' }
      }
    ];

    const ports = extractCustomNodePorts({ nodes });
    expect(ports.inputs[0].type).toBe('vec3');
  });

  it('should preserve sequential subgraph edits across multiple save cycles', () => {
    const baseNode: CustomNodeDefinition = {
      id: 'custom_multi_save',
      label: 'Multi Save',
      description: '',
      compact: false,
      inputs: [],
      outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
      isCustom: true,
      subgraph: { nodes: [], edges: [] },
      glslTemplate: () => 'vec3(1.0)',
    };

    addCustomNode(baseNode);

    const roundOne: CustomNodeDefinition = {
      ...baseNode,
      subgraph: {
        nodes: [{
          id: 'float_1',
          type: 'shaderNode',
          position: { x: 10, y: 20 },
          data: { definition: NODE_REGISTRY['input_float'], value: 1.5 }
        }] as Node[],
        edges: []
      }
    };
    addCustomNode(roundOne);

    const roundTwo: CustomNodeDefinition = {
      ...loadCustomNodes()[0],
      subgraph: {
        nodes: [
          ...loadCustomNodes()[0].subgraph.nodes,
          {
            id: 'sin_1',
            type: 'shaderNode',
            position: { x: 220, y: 20 },
            data: { definition: NODE_REGISTRY['math_sin'] }
          }
        ] as Node[],
        edges: [{
          id: 'edge_float_sin',
          source: 'float_1',
          sourceHandle: 'out',
          target: 'sin_1',
          targetHandle: 'in'
        }] as Edge[]
      }
    };
    addCustomNode(roundTwo);

    const restored = loadCustomNodes()[0];

    expect(restored.subgraph.nodes.map(node => node.id)).toEqual(['float_1', 'sin_1']);
    expect(restored.subgraph.edges).toHaveLength(1);
    expect(restored.subgraph.edges[0].id).toBe('edge_float_sin');
    expect(restored.subgraph.nodes[0].data.value).toBe(1.5);
  });

  it('should preserve output port labels and types after repeated extraction and save', () => {
    const customNode: CustomNodeDefinition = {
      id: 'custom_output_refresh',
      label: 'Output Refresh',
      description: '',
      compact: false,
      inputs: [],
      outputs: [],
      isCustom: true,
      subgraph: {
        nodes: [
          {
            id: 'custom_output_alpha',
            type: 'shaderNode',
            position: { x: 400, y: 0 },
            data: { definition: NODE_REGISTRY['custom_output'], value: 'Alpha', detectedType: 'float' }
          },
          {
            id: 'custom_output_color',
            type: 'shaderNode',
            position: { x: 400, y: 100 },
            data: { definition: NODE_REGISTRY['custom_output'], value: 'Color', detectedType: 'vec4' }
          }
        ] as Node[],
        edges: []
      },
      glslTemplate: () => 'vec4(1.0)',
    };

    const firstPorts = extractCustomNodePorts({ nodes: customNode.subgraph.nodes });
    addCustomNode({ ...customNode, outputs: firstPorts.outputs });

    const loaded = loadCustomNodes()[0];
    const secondPorts = extractCustomNodePorts({ nodes: loaded.subgraph.nodes });

    expect(firstPorts.outputs).toEqual(secondPorts.outputs);
    expect(secondPorts.outputs).toEqual([
      { id: 'custom_output_alpha', label: 'Alpha', type: 'float' },
      { id: 'custom_output_color', label: 'Color', type: 'vec4' },
    ]);
  });

  it('should round-trip subgraph node values and positions through storage', () => {
    const customNode: CustomNodeDefinition = {
      id: 'custom_round_trip',
      label: 'Round Trip',
      description: '',
      compact: false,
      inputs: [],
      outputs: [{ id: 'out', label: 'Out', type: 'vec3' }],
      isCustom: true,
      subgraph: {
        nodes: [
          {
            id: 'float_1',
            type: 'shaderNode',
            position: { x: 321, y: 654 },
            data: {
              definition: NODE_REGISTRY['input_float'],
              value: 42.5,
            }
          }
        ] as Node[],
        edges: []
      },
      glslTemplate: () => 'vec3(1.0)',
    };

    addCustomNode(customNode);
    const restored = loadCustomNodes()[0];

    expect(restored.subgraph.nodes[0].position).toEqual({ x: 321, y: 654 });
    expect(restored.subgraph.nodes[0].data.value).toBe(42.5);
    expect(restored.subgraph.nodes[0].data.definition.id).toBe('input_float');
  });
});
